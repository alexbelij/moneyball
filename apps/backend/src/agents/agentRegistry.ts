/**
 * agentRegistry | v1.0.0 | 2026-06-18 (T52)
 * Purpose: Single-call registry that returns all agents with profile, stats,
 * and runtime status. Eliminates the need for the frontend to hardcode
 * AGENT_IDS and make N+1 requests.
 *
 * GET /api/public/agents → { ok, agents: AgentRegistryEntry[] }
 *
 * This is a read-only view. Agent config comes from agent-config.v1.json,
 * stats come from AgentEventService, status from InMemoryWorldStateStore.
 */

import type { AgentEventService } from './agentEventService'
import { AgentProfileService, type PublicAgentProfile } from './agentProfileService'
import type { InMemoryWorldStateStore } from '../realtime/worldStateStore'

export interface AgentStats {
  predictions: number
  outcomes: number
  correctOutcomes: number
  /** Accuracy as fraction [0, 1]. null if no outcomes yet. */
  accuracy: number | null
  evolutions: number
  substantiveEvolutions: number
  sleptCycles: number
}

export interface AgentRegistryEntry {
  profile: PublicAgentProfile
  stats: AgentStats
  /** Live status from the world state (idle / thinking / acting). */
  status: string
}

export class AgentRegistry {
  private readonly profiles: AgentProfileService

  constructor(
    private readonly events: AgentEventService,
    private readonly world: InMemoryWorldStateStore,
    profiles?: AgentProfileService,
  ) {
    this.profiles = profiles ?? new AgentProfileService()
  }

  /** Return all registered agents with profile + stats + status. */
  list(): AgentRegistryEntry[] {
    const agentIds = this.profiles.ids()
    const worldState = this.world.getState()
    const statusMap = new Map(worldState.agents.map((a) => [a.agentId, a.status]))

    return agentIds.map((id) => {
      const profile = this.profiles.get(id)!

      const totalEvolutions = this.events.evolutionCount(id)
      const substantiveEvolutions = this.events.substantiveEvolutionCount(id)
      const outcomes = this.events.outcomeCount(id)

      // Compute accuracy from outcomes
      const outcomeList = (this.events as any).outcomeIndex?.get(id) ?? []
      const correctCount = outcomeList.filter((o: any) => o.correct).length

      const stats: AgentStats = {
        predictions: this.events.predictionCount(id),
        outcomes,
        correctOutcomes: correctCount,
        accuracy: outcomes > 0 ? correctCount / outcomes : null,
        evolutions: totalEvolutions,
        substantiveEvolutions,
        sleptCycles: totalEvolutions - substantiveEvolutions,
      }

      return {
        profile,
        stats,
        status: statusMap.get(id) ?? 'idle',
      }
    })
  }

  /** Get a single agent by ID. */
  get(agentId: string): AgentRegistryEntry | null {
    const profile = this.profiles.get(agentId)
    if (!profile) return null

    const all = this.list()
    return all.find((a) => a.profile.id === agentId) ?? null
  }
}
