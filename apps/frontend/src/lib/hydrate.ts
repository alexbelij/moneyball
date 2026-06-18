/**
 * hydrate | v1.1.0 | 2026-06-18
 * Purpose: REST hydration on socket (re)connect — fetch latest agent data so
 * the room populates immediately without waiting for the next server tick.
 * T18: called from useSocket on every connect event.
 * T52: uses Agent Registry to discover IDs dynamically (fallback to hardcoded).
 */

import { getAgentPredictions, getAgentRegistry } from '@/lib/api'
import { useGameStore } from '@/store/gameStore'

/** Fallback agent IDs if the registry endpoint is unavailable. */
const FALLBACK_AGENT_IDS = ['dr_morgan', 'scout_alvarez', 'viktor_kane', 'sofia_mendes', 'madame_pythia'] as const

/**
 * Best-effort REST hydration. Fetches latest predictions for all agents.
 * Failures are silently caught — socket events will fill the gap.
 */
export async function hydrateFromRest(): Promise<void> {
  try {
    // T52: discover agent IDs from registry, fallback to hardcoded
    let agentIds: readonly string[] = FALLBACK_AGENT_IDS
    try {
      const registry = await getAgentRegistry()
      if (registry.ok && registry.agents.length > 0) {
        agentIds = registry.agents.map((a) => a.profile.id)
      }
    } catch {
      // Registry not available — use fallback
    }

    const results = await Promise.allSettled(
      agentIds.map((id) => getAgentPredictions(id)),
    )
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
