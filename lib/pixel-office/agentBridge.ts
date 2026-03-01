import { OfficeState } from './engine/officeState'

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

/** Track which subagent toolIds were active last sync, per parent agent */
const prevSubagentKeys = new Map<string, Set<string>>()

/** Track previous agent states to detect offline→working transitions */
const prevAgentStates = new Map<string, string>()

/** Track which room each agent is currently in */
const prevAgentRooms = new Map<string, 'work' | 'lounge'>()

export function syncAgentsToOffice(
  activities: AgentActivity[],
  office: OfficeState,
  agentIdMap: Map<string, number>,
  nextIdRef: { current: number },
): void {
  const currentAgentIds = new Set(activities.map(a => a.id))

  // Remove agents that are no longer present
  for (const [agentId, charId] of agentIdMap) {
    if (!currentAgentIds.has(agentId)) {
      office.removeAllSubagents(charId)
      office.removeAgent(charId)
      agentIdMap.delete(agentId)
      prevSubagentKeys.delete(agentId)
      prevAgentStates.delete(agentId)
      prevAgentRooms.delete(agentId)
    }
  }

  for (const activity of activities) {
    // For now, we don't remove agents when idle - they stay in the office
    // The main agent always stays, subagents come and go

    let charId = agentIdMap.get(activity.id)
    if (charId === undefined) {
      charId = nextIdRef.current++
      agentIdMap.set(activity.id, charId)
      // Spawn at door for new agents
      office.addAgent(charId, undefined, undefined, undefined, undefined, true)
    }

    // Set label (agent name or id)
    const ch = office.characters.get(charId)
    if (ch) {
      ch.label = activity.name || activity.id

      // Determine target room based on status
      const targetRoom: 'work' | 'lounge' = activity.status === 'idle' ? 'lounge' : 'work'

      // Move agent to appropriate room if status changed
      const prevRoom = prevAgentRooms.get(activity.id)
      if (prevRoom !== targetRoom) {
        office.moveAgentToRoom(charId, targetRoom)
        prevAgentRooms.set(activity.id, targetRoom)
      }

      // Update agent state
      switch (activity.status) {
        case 'working':
          office.setAgentActive(charId, true)
          // Extract tool name from activity string like "执行工具: xxx"
          const toolMatch = activity.activity.match(/执行工具:\s*(.+)/)
          office.setAgentTool(charId, toolMatch ? toolMatch[1] : null)
          break
        case 'chatting':
          office.setAgentActive(charId, true)
          office.setAgentTool(charId, null)
          break
        case 'idle':
        default:
          office.setAgentActive(charId, false)
          office.setAgentTool(charId, null)
          break
      }
    }

    // Sync subagents
    const currentSubKeys = new Set<string>()
    if (activity.subagents) {
      for (const sub of activity.subagents) {
        currentSubKeys.add(sub.toolId)
        const existingSubId = office.getSubagentId(charId, sub.toolId)
        if (existingSubId === null) {
          const subId = office.addSubagent(charId, sub.toolId)
          office.setAgentActive(subId, true)
          // Subagents always work in the work room
          office.moveAgentToRoom(subId, 'work')
        }
      }
    }

    // Remove subagents that are no longer active
    const prevKeys = prevSubagentKeys.get(activity.id)
    if (prevKeys) {
      for (const toolId of prevKeys) {
        if (!currentSubKeys.has(toolId)) {
          office.removeSubagent(charId, toolId)
        }
      }
    }
    prevSubagentKeys.set(activity.id, currentSubKeys)
    prevAgentStates.set(activity.id, activity.status)
  }
}
