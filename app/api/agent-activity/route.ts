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
    const activeSubtasks = new Map<string, string>()

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]
      try {
        const record = JSON.parse(line)

        // Check for tool use
        if (record.type === 'assistant' && record.message?.content) {
          const blocks = Array.isArray(record.message.content) ? record.message.content : []
          for (const block of blocks) {
            if (block.type === 'tool_use') {
              if (block.input?.description) {
                const desc = block.input.description as string
                // Check if it's a subtask
                if (desc.startsWith('Subtask:') || desc.includes('subtask')) {
                  activeSubtasks.set(block.id, desc)
                } else {
                  lastToolUse = `执行工具: ${block.name || 'exec'}`
                }
              } else if (block.name) {
                lastToolUse = `执行工具: ${block.name}`
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

    if (timeDiff > 5 * 60 * 1000) {
      // 5 minutes no activity = idle
      result.status = 'idle'
      result.activity = '休息中'
    } else if (lastToolUse) {
      result.status = 'working'
      result.activity = lastToolUse
    } else {
      result.status = 'chatting'
      result.activity = '聊天中'
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
  const configPath = path.join(openclawDir, 'openclaw.json')
  const agentsDir = path.join(openclawDir, 'agents')

  const agents: AgentActivity[] = []

  try {
    if (existsSync(configPath)) {
      const configContent = await fs.readFile(configPath, 'utf8')
      const config = JSON.parse(configContent)

      const agentList = Array.isArray(config.agents) ? config.agents : config.agents?.list
      if (agentList && Array.isArray(agentList)) {
        for (const agent of agentList) {
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
    }
  } catch (error) {
    console.error('Error reading agent activity:', error)
  }

  return NextResponse.json({ agents })
}
