/**
 * agentPersonaService | v1.0.0 | 2026-06-13
 * Purpose: Server-side access to each agent's flavour lines — roastLines and
 * thoughtBubbles — from agent-config.v1.json (T29). Drives:
 *   - personalised /api/roast (deterministic per user+agent+day)
 *   - GET /api/public/agents/:id/thoughts (room thought-bubble cycling)
 *
 * Selection is DETERMINISTIC: the same (userId, agentId, day) always yields the
 * same roast. No LLM — the LLM-dynamic variant is the separate T32 task.
 */

import agentConfig from './agent-config.v1.json'

export type ThoughtState = 'analyzing' | 'watching' | 'coffee' | 'arguing' | 'busy'

export const THOUGHT_STATES: readonly ThoughtState[] = [
  'analyzing', 'watching', 'coffee', 'arguing', 'busy',
] as const

export interface AgentPersona {
  id: string
  roastLines: string[]
  thoughtBubbles: Record<ThoughtState, string[]>
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : []
}

function buildPersona(raw: any): AgentPersona {
  const tb = raw?.thoughtBubbles ?? {}
  const thoughtBubbles = {} as Record<ThoughtState, string[]>
  for (const s of THOUGHT_STATES) thoughtBubbles[s] = strArr(tb[s])
  return {
    id: String(raw?.id ?? ''),
    roastLines: strArr(raw?.roastLines),
    thoughtBubbles,
  }
}

/**
 * Tiny deterministic 32-bit string hash (FNV-1a). Stable across runs/platforms
 * so the same seed always selects the same line.
 */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** UTC day key (YYYY-MM-DD) for a given date — the daily rotation bucket. */
export function dayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

/** Deterministically pick one item from a list given a seed. Empty → null. */
export function pickDeterministic<T>(items: T[], seed: string): T | null {
  if (items.length === 0) return null
  return items[hashString(seed) % items.length]
}

export class AgentPersonaService {
  private readonly byId: Map<string, AgentPersona>

  constructor(config: any = agentConfig) {
    const agents = Array.isArray(config?.agents) ? config.agents : []
    this.byId = new Map(agents.map((a: any) => {
      const p = buildPersona(a)
      return [p.id, p] as const
    }))
  }

  get(agentId: string): AgentPersona | null {
    return this.byId.get(agentId) ?? null
  }

  /**
   * Personalised roast line for (userId, agentId) on a given day. Deterministic:
   * stable for the whole UTC day, rotates daily. Returns null if the agent is
   * unknown or has no roast lines.
   */
  roastFor(agentId: string, userId: string, date: Date = new Date()): string | null {
    const persona = this.byId.get(agentId)
    if (!persona) return null
    return pickDeterministic(persona.roastLines, `${userId}|${agentId}|${dayKey(date)}`)
  }

  /** Thought bubbles for an agent, grouped by state. Null if unknown. */
  thoughtsFor(agentId: string): Record<ThoughtState, string[]> | null {
    const persona = this.byId.get(agentId)
    return persona ? persona.thoughtBubbles : null
  }
}
