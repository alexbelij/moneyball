/**
 * agentProfileService | v1.0.0 | 2026-06-13
 * Purpose: Expose each agent's PUBLIC profile (identity + methodology) from
 * agent-config.v1.json. No secrets — personality data only. Drives the
 * "Methodology" section in the AgentModal dossier (T26).
 *
 * Pure & deterministic: maps raw config → a typed public profile. roastLines
 * and thoughtBubbles are deliberately NOT exposed here (used elsewhere, T29).
 */

import agentConfig from './agent-config.v1.json'

/** A single deterministic-mysticism rule (Madame Pythia). */
export interface PublicMethodologyRule {
  name: string
  logic: string
  effect: string
}

/** Public, secret-free view of an agent's methodology. */
export interface PublicMethodology {
  type: string
  /** Weighted/EV/contrarian agents expose a formula; mystics expose rules. */
  formula: string | null
  /** Plain-language description (present for rule-based mysticism). */
  description: string | null
  parameters: Record<string, number>
  evolutionTrigger: string | null
  /** Deterministic mysticism rule list (Madame Pythia). Empty for others. */
  rules: PublicMethodologyRule[]
}

/** Public, secret-free view of an agent. */
export interface PublicAgentProfile {
  id: string
  name: string
  role: string
  personality: string
  catchphrases: string[]
  methodology: PublicMethodology
}

function toRule(r: any): PublicMethodologyRule {
  return {
    name: String(r?.name ?? ''),
    logic: String(r?.logic ?? ''),
    effect: String(r?.effect ?? ''),
  }
}

/** Map one raw config agent → its public profile. Pure. */
export function buildPublicProfile(raw: any): PublicAgentProfile {
  const m = raw?.methodology ?? {}
  const rules: PublicMethodologyRule[] = Array.isArray(m.rules) ? m.rules.map(toRule) : []
  return {
    id: String(raw?.id ?? ''),
    name: String(raw?.name ?? ''),
    role: String(raw?.role ?? ''),
    personality: String(raw?.personality ?? ''),
    catchphrases: Array.isArray(raw?.catchphrases) ? raw.catchphrases.map(String) : [],
    methodology: {
      type: String(m.type ?? 'unknown'),
      formula: typeof m.formula === 'string' ? m.formula : null,
      description: typeof m.description === 'string' ? m.description : null,
      parameters: (m.parameters ?? {}) as Record<string, number>,
      evolutionTrigger: typeof m.evolution_trigger === 'string' ? m.evolution_trigger : null,
      rules,
    },
  }
}

/** In-memory profile registry, built once from the bundled config. */
export class AgentProfileService {
  private readonly byId: Map<string, PublicAgentProfile>

  constructor(config: any = agentConfig) {
    const agents = Array.isArray(config?.agents) ? config.agents : []
    this.byId = new Map(agents.map((a: any) => {
      const p = buildPublicProfile(a)
      return [p.id, p] as const
    }))
  }

  /** All known agent ids. */
  ids(): string[] {
    return [...this.byId.keys()]
  }

  /** Public profile for one agent, or null if unknown. */
  get(agentId: string): PublicAgentProfile | null {
    return this.byId.get(agentId) ?? null
  }

  /** All public profiles. */
  list(): PublicAgentProfile[] {
    return [...this.byId.values()]
  }
}
