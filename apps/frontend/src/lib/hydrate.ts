/**
 * hydrate | v1.0.0 | 2026-06-13
 * Purpose: REST hydration on socket (re)connect — fetch latest agent data so
 * the room populates immediately without waiting for the next server tick.
 * T18: called from useSocket on every connect event.
 */

import { getAgentPredictions } from '@/lib/api'
import { useGameStore } from '@/store/gameStore'

/** Agent IDs (match backend AGENT_IDS). */
const AGENT_IDS = ['dr_morgan', 'scout_alvarez', 'viktor_kane', 'sofia_mendes', 'madame_pythia'] as const

/**
 * Best-effort REST hydration. Fetches latest predictions for all agents.
 * Failures are silently caught — socket events will fill the gap.
 */
export async function hydrateFromRest(): Promise<void> {
  try {
    const results = await Promise.allSettled(
      AGENT_IDS.map((id) => getAgentPredictions(id)),
    )
    // Store predictions in gameStore for AgentModal / StatsBoard.
    // applyWorldState handles agent presence (from socket); predictions are
    // cached per-agent so AgentModal can display them immediately.
    const store = useGameStore.getState()
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.ok) {
        store.cachePredictions(r.value.agentId, r.value.items)
      }
    }
  } catch {
    // Non-critical: socket events will provide data eventually.
  }
}
