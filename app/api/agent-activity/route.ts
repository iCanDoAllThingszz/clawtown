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
  status: 'idle' | 'chatting' | 'working'
  activity: string
  lastUpdate: number
  subagents?: SubagentInfo[]
  // Backward compatibility fields
  agentId?: string
  state?: string
  emoji?: string
}

interface ParsedState {
  status: 'idle' | 'chatting' | 'working'
  activity: string
  lastUpdate: number
  subagents: SubagentInfo[]
}

/** Parse the last N lines of the most recent session file for activity patterns */
async function parseSessionActivity(agentSessionsDir: string): Promise<ParsedState> {
  const result: ParsedState = {
    status: 'idle',
    activity: '',
    lastUpdate: 0,
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

    result.lastUpdate = latestTime

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
    let lastSkillUse: string | null = null
    let isHeartbeat = false
    const activeSubtasks = new Map<string, string>()

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]
      try {
        const record = JSON.parse(line)

        // Check for heartbeat
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
              
              if (block.input?.description) {
                const desc = block.input.description as string
                // Check if it's a subtask (skill execution)
                if (desc.startsWith('Subtask:') || desc.includes('subtask')) {
                  activeSubtasks.set(block.id, desc)
                  lastSkillUse = `执行技能: ${desc.split(':')[1]?.trim() || 'unknown'}`
                } else {
                  lastToolUse = `${toolName}`
                }
              } else {
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

    // Determine status
    const now = Date.now()
    const timeDiff = now - latestTime

    // Heartbeat within 2 minutes = idle (休息中)
    if (isHeartbeat && timeDiff < 2 * 60 * 1000) {
      result.status = 'idle'
      result.activity = '摸鱼中 🐟'
    } else if (timeDiff > 10 * 60 * 1000) {
      // 10 minutes no activity = idle
      result.status = 'idle'
      result.activity = '下班了？'
    } else if (lastSkillUse) {
      // Skill execution = working (工作室)
      result.status = 'working'
      result.activity = lastSkillUse
    } else if (lastToolUse) {
      // Tool use = chatting (聊天室)
      result.status = 'chatting'
      result.activity = `调用${lastToolUse}`
    } else {
      result.status = 'chatting'
      result.activity = '思考人生中...'
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

  const agents: AgentActivity[] = []

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
            status: parsedState?.status || 'idle',
            state: parsedState?.status || 'idle', // Backward compatibility
            activity: parsedState?.activity || '休息中',
            lastUpdate: parsedState?.lastUpdate || Date.now(),
            emoji: agent.identity?.emoji || agent.emoji || '🤖', // Backward compatibility
          }

          if (parsedState?.subagents && parsedState.subagents.length > 0) {
            activity.subagents = parsedState.subagents
          }

          agents.push(activity)

          // Add subagents as separate entries
          if (parsedState?.subagents) {
            for (const subagent of parsedState.subagents) {
              agents.push({
                id: `subagent:${subagent.toolId}`,
                agentId: `subagent:${subagent.toolId}`, // Backward compatibility
                name: agent.name || agent.id,
                label: subagent.label.replace(/^Subtask:\s*/, ''),
                status: 'working',
                state: 'working', // Backward compatibility
                activity: '执行任务',
                lastUpdate: parsedState.lastUpdate,
                emoji: '🤖',
              })
            }
          }
      }
    }
  } catch (error) {
    console.error('Error reading agent activity:', error)
  }

  return NextResponse.json({ agents })
}
