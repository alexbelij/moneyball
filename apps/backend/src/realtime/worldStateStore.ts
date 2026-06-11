import type { WorldAgentState, WorldId, WorldStatePayload } from '@moneyball/shared/events'

export interface WorldStateStore {
  getState(): WorldStatePayload
  joinClient(socketId: string): void
  leaveClient(socketId: string): void
  tick(): number
  setAgents(agents: WorldAgentState[]): void
  updateAgent(agentId: string, patch: Partial<WorldAgentState>): void
}

export class InMemoryWorldStateStore implements WorldStateStore {
  private tickCounter = 0
  private clients = new Set<string>()
  private agents = new Map<string, WorldAgentState>()

  constructor(private worldId: WorldId) {}

  getState(): WorldStatePayload {
    return {
      worldId: this.worldId,
      tick: this.tickCounter,
      serverTime: new Date().toISOString(),
      connectedClients: this.clients.size,
      agents: Array.from(this.agents.values()),
    }
  }

  joinClient(socketId: string) {
    this.clients.add(socketId)
  }

  leaveClient(socketId: string) {
    this.clients.delete(socketId)
  }

  tick(): number {
    this.tickCounter += 1
    return this.tickCounter
  }

  setAgents(agents: WorldAgentState[]) {
    this.agents.clear()
    for (const a of agents) this.agents.set(a.agentId, a)
  }

  updateAgent(agentId: string, patch: Partial<WorldAgentState>) {
    const curr = this.agents.get(agentId)
    if (!curr) return
    this.agents.set(agentId, { ...curr, ...patch })
  }
}
