import { OfficeState } from './engine/officeState'

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

/** Track which subagent IDs are active */
const prevSubagentIds = new Set<string>()

/** Track previous agent states to detect state changes */
const prevAgentStates = new Map<string, string>()

/** Track subagent characters that are completing (for fade out animation) */
const completingSubagents = new Map<string, NodeJS.Timeout>()

export function syncAgentsToOffice(
  mainAgents: AgentActivity[],
  subagents: SubagentActivity[],
  office: OfficeState,
  agentIdMap: Map<string, number>,
  nextIdRef: { current: number },
): void {
  const currentAgentIds = new Set(mainAgents.map(a => a.id))

  // Remove main agents that are no longer present
  for (const [agentId, charId] of agentIdMap) {
    if (!currentAgentIds.has(agentId)) {
      office.removeAllSubagents(charId)
      office.removeAgent(charId)
      agentIdMap.delete(agentId)
      prevAgentStates.delete(agentId)
    }
  }

  // Sync main agents
  for (const activity of mainAgents) {
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

      // Update agent state
      switch (activity.status) {
        case 'working':
        case 'delegating':
          office.setAgentActive(charId, true)
          // Extract tool name from activity string
          const toolMatch = activity.activity.match(/调用(.+)/)
          office.setAgentTool(charId, toolMatch ? toolMatch[1] : null)
          break
        case 'idle':
        default:
          office.setAgentActive(charId, false)
          office.setAgentTool(charId, null)
          break
      }
    }

    prevAgentStates.set(activity.id, activity.status)
  }

  // Sync subagents - manage lifecycle
  const currentSubIds = new Set(subagents.map(s => s.id))

  // Remove subagents that are no longer active
  for (const [subIdStr, timeout] of completingSubagents) {
    clearTimeout(timeout)
    completingSubagents.delete(subIdStr)
  }

  // Check for subagents that need to be removed
  for (const [charId, ch] of office.characters) {
    if (ch.label && ch.label.startsWith('subagent:')) {
      const subId = ch.label
      if (!currentSubIds.has(subId)) {
        // Subagent completed - remove after 2 seconds
        const timeout = setTimeout(() => {
          office.removeAgent(charId)
          completingSubagents.delete(subId)
        }, 2000)
        completingSubagents.set(subId, timeout)
      }
    }
  }

  // Add or update subagents
  for (const sub of subagents) {
    // Find if subagent character already exists
    let subCharId: number | null = null
    for (const [charId, ch] of office.characters) {
      if (ch.label === sub.id) {
        subCharId = charId
        break
      }
    }

    if (subCharId === null) {
      // New subagent - spawn at door
      subCharId = nextIdRef.current++
      office.addAgent(subCharId, undefined, undefined, undefined, undefined, true)
      const ch = office.characters.get(subCharId)
      if (ch) {
        ch.label = sub.id
        office.setAgentActive(subCharId, true)
        office.setAgentTool(subCharId, sub.activity)
      }
    } else {
      // Update existing subagent
      office.setAgentActive(subCharId, true)
      office.setAgentTool(subCharId, sub.activity)
    }
  }

  prevSubagentIds.clear()
  for (const sub of subagents) {
    prevSubagentIds.add(sub.id)
  }
}
