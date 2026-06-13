/**
 * thoughtCycle | v1.0.0 | 2026-06-13
 * Purpose: Pure logic for room thought-bubble cycling (T29). Maps an agent's
 * live status to a thought-bubble state and deterministically picks a line for
 * a given cycle tick. Kept Phaser-free so it can be unit-tested in jsdom; the
 * CabinetScene wires these into AgentSprite.showThought.
 *
 * Deterministic: same (agentId, state, tick) → same line.
 */

export type ThoughtState = 'analyzing' | 'watching' | 'coffee' | 'arguing' | 'busy'

/** Mirrors @moneyball/shared AgentStatus, kept local to avoid coupling. */
export type AgentStatusLike = 'idle' | 'thinking' | 'acting' | 'busy' | string

/** Map a live agent status to the thought-bubble state it should show. */
export function mapStatusToThoughtState(status: AgentStatusLike): ThoughtState {
  switch (status) {
    case 'thinking':
      return 'analyzing'
    case 'acting':
      return 'arguing'
    case 'busy':
      return 'busy'
    case 'idle':
      return 'watching'
    default:
      return 'coffee'
  }
}

/** Deterministic FNV-1a 32-bit hash (matches backend agentPersonaService). */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Deterministically pick one line for a seed. Empty → null. */
export function pickLine(lines: string[], seed: string): string | null {
  if (lines.length === 0) return null
  return lines[hashString(seed) % lines.length]
}

/**
 * Pick the thought line for an agent given its current state and a cycle tick.
 * `bubbles` is the per-state map fetched from /thoughts. Returns null if the
 * state has no lines.
 */
export function thoughtForCycle(
  agentId: string,
  state: ThoughtState,
  bubbles: Partial<Record<ThoughtState, string[]>> | null | undefined,
  tick: number,
): string | null {
  const lines = bubbles?.[state] ?? []
  return pickLine(lines, `${agentId}|${state}|${tick}`)
}
