import { NextResponse } from 'next/server'
import { promises as fs, existsSync } from 'fs'
import path from 'path'
import os from 'os'

export interface SubagentInfo {
  toolId: string
  label: string
}

export interface AgentActivity {
  id: string
  name: string
  label?: string
  status: 'idle' | 'working' | 'delegating'
  activity: string
  lastUpdate: number
  // Backward compatibility fields
  agentId?: string
  state?: string
  emoji?: string
}

export interface SubagentActivity {
  id: string
  label: string
  status: 'working'
  activity: string
  lastUpdate: number
}

interface ParsedMainAgentState {
  status: 'idle' | 'working' | 'delegating'
  activity: string
  lastUpdate: number
}

interface ParsedState {
  mainAgent: ParsedMainAgentState
  subagents: SubagentInfo[]
}

/** Parse the last N lines of the most recent session file for activity patterns */
async function parseSessionActivity(agentSessionsDir: string): Promise<ParsedState> {
  const result: ParsedState = {
    mainAgent: {
      status: 'idle',
      activity: '',
      lastUpdate: 0,
    },
    subagents: []
  }

  try {
    const files = await fs.readdir(agentSessionsDir)
    if (files.length === 0) return result

    // Find most recent file
    let latestFile = ''
    let latestTime = 0
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue
      const filePath = path.join(agentSessionsDir, file)
      const stat = await fs.stat(filePath)
      if (stat.mtimeMs > latestTime) {
        latestTime = stat.mtimeMs
        latestFile = filePath
      }
    }
    if (!latestFile) return result

    result.mainAgent.lastUpdate = latestTime

    // Read last 16KB for recent activity
    const stat = await fs.stat(latestFile)
    const readSize = Math.min(16384, stat.size)
    const handle = await fs.open(latestFile, 'r')
    const buffer = Buffer.alloc(readSize)
    await handle.read(buffer, 0, readSize, Math.max(0, stat.size - readSize))
    await handle.close()

    const content = buffer.toString('utf-8')
    const lines = content.split('\n').filter(l => l.trim())

    // Look for recent tool_use entries
    let lastToolUse: string | null = null
    let isHeartbeat = false
    let recentSpawnTime: number | null = null
    const activeSubtasks = new Map<string, string>()

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]
      try {
        const record = JSON.parse(line)

        // Check for heartbeat (last assistant message)
        if (record.type === 'user' && record.message?.content) {
          const content = typeof record.message.content === 'string' ? record.message.content : ''
          if (content.includes('HEARTBEAT') || content.includes('Read HEARTBEAT.md')) {
            isHeartbeat = true
          }
        }

        // Check for tool use
        if (record.type === 'assistant' && record.message?.content) {
          const blocks = Array.isArray(record.message.content) ? record.message.content : []
          for (const block of blocks) {
            if (block.type === 'tool_use') {
              const toolName = block.name || 'exec'

              // Check for sessions_spawn (delegating)
              if (toolName === 'sessions_spawn') {
                recentSpawnTime = Date.now()
                const task = block.input?.task as string | undefined
                activeSubtasks.set(block.id, task || 'Subtask')
              }

              // Check for skill execution (subtask with task param)
              const hasTask = block.input?.task && typeof block.input.task === 'string'
              if (hasTask && toolName !== 'sessions_spawn') {
                const task = block.input.task as string
                activeSubtasks.set(block.id, task)
              }

              if (block.input?.description) {
                const desc = block.input.description as string
                if (desc.startsWith('Subtask:') || desc.includes('subtask')) {
                  activeSubtasks.set(block.id, desc)
                } else if (toolName !== 'sessions_spawn') {
                  lastToolUse = `${toolName}`
                }
              } else if (toolName !== 'sessions_spawn') {
                lastToolUse = `${toolName}`
              }
            }
          }
        }

        // Clear completed subtasks
        if (record.type === 'user' && record.message?.content) {
          const blocks = Array.isArray(record.message.content) ? record.message.content : []
          for (const block of blocks) {
            if (block.type === 'tool_result' && block.tool_use_id) {
              activeSubtasks.delete(block.tool_use_id)
            }
          }
        }
      } catch {
        // Skip unparseable lines
      }
    }

    // Determine main agent status
    const now = Date.now()
    const timeDiff = now - latestTime
    const spawnDiff = recentSpawnTime ? now - recentSpawnTime : null

    // Priority 1: Check for recent sessions_spawn (within 30 seconds) = delegating
    if (spawnDiff !== null && spawnDiff < 30 * 1000) {
      result.mainAgent.status = 'delegating'
      result.mainAgent.activity = '分派任务中...'
    }
    // Priority 2: Check for HEARTBEAT_OK (within 2 minutes) = idle
    else if (isHeartbeat && timeDiff < 2 * 60 * 1000) {
      result.mainAgent.status = 'idle'
      result.mainAgent.activity = '摸鱼中 🐟'
    }
    // Priority 3: No activity for 10 minutes = idle
    else if (timeDiff > 10 * 60 * 1000) {
      result.mainAgent.status = 'idle'
      result.mainAgent.activity = '下班了？'
    }
    // Priority 4: Has active subtasks = working
    else if (activeSubtasks.size > 0) {
      result.mainAgent.status = 'working'
      result.mainAgent.activity = '工作中...'
    }
    // Priority 5: Has tool use = working
    else if (lastToolUse) {
      result.mainAgent.status = 'working'
      result.mainAgent.activity = `调用${lastToolUse}`
    }
    // Default: working in chat room
    else {
      result.mainAgent.status = 'working'
      result.mainAgent.activity = '思考人生中...'
    }

    // Add active subtasks
    for (const [toolId, label] of activeSubtasks) {
      result.subagents.push({ toolId, label })
    }

  } catch {
    // Ignore parse errors
  }
  return result
}

export async function GET() {
  const openclawDir = path.join(os.homedir(), '.openclaw')
  const agentsDir = path.join(openclawDir, 'agents')

  const mainAgents: AgentActivity[] = []
  const subagents: SubagentActivity[] = []

  try {
    // Fetch from /api/config instead
    const configRes = await fetch('http://localhost:3001/api/config')
    const config = await configRes.json()

    if (config.agents && Array.isArray(config.agents)) {
      for (const agent of config.agents) {
          let agentSessionsDir = ''
          let parsedState: ParsedState | null = null

          if (existsSync(agentsDir)) {
            agentSessionsDir = path.join(agentsDir, agent.id, 'sessions')
            if (existsSync(agentSessionsDir)) {
              parsedState = await parseSessionActivity(agentSessionsDir)
            }
          }

          // Get main agent activity
          const activity: AgentActivity & { agentId?: string; state?: string; emoji?: string } = {
            id: agent.id,
            agentId: agent.id, // Backward compatibility
            name: agent.name || agent.id,
            status: parsedState?.mainAgent.status || 'idle',
            state: parsedState?.mainAgent.status || 'idle', // Backward compatibility
            activity: parsedState?.mainAgent.activity || '休息中',
            lastUpdate: parsedState?.mainAgent.lastUpdate || Date.now(),
            emoji: agent.identity?.emoji || agent.emoji || '🤖', // Backward compatibility
          }

          mainAgents.push(activity)

          // Add subagents as separate entries
          if (parsedState?.subagents) {
            for (const sub of parsedState.subagents) {
              subagents.push({
                id: `subagent:${sub.toolId}`,
                label: sub.label.replace(/^Subtask:\s*/, ''),
                status: 'working',
                activity: '执行任务',
                lastUpdate: parsedState.mainAgent.lastUpdate,
              })
            }
          }
      }
    }
  } catch (error) {
    console.error('Error reading agent activity:', error)
  }

  return NextResponse.json({ agents: mainAgents, subagents })
}
