/**
 * agentRegistry | v1.0.0 | 2026-06-17
 * Purpose: Unified registry for core (hardcoded) + connected (runtime-registered)
 * agents (T52/T54). Core agents are loaded from agent-config.v1.json; connected
 * agents register via POST /api/hive/agents.
 *
 * Connected agent IDs are namespaced: 'ext:<slug>' to prevent collisions.
 * Text fields are sanitised (HTML-escaped, length-limited, no Cyrillic).
 */

import type { AgentConfig, HiveRegisterBody } from '@moneyball/shared/hive'
import agentConfigJson from './agent-config.v1.json'

// ── Text sanitisation ───────────────────────────────────────────────────

const CYRILLIC_RE = /[\u0400-\u04FF]/
const MAX_NAME = 40
const MAX_ROLE = 60
const MAX_PERSONA = 200
const MAX_METHODOLOGY = 300
const MAX_CONNECTED = 50

/** Basic HTML entity escaping to prevent XSS in connected-agent text. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 30)
}

// ── Core agent adapter ──────────────────────────────────────────────────

function buildCoreConfigs(): AgentConfig[] {
  const agents = (agentConfigJson as any)?.agents
  if (!Array.isArray(agents)) return []
  return agents.map((a: any) => ({
    agentId: String(a.id ?? ''),
    name: String(a.name ?? ''),
    role: String(a.role ?? ''),
    persona: String(a.personality ?? '').slice(0, MAX_PERSONA),
    methodology: String(a.methodology?.type ?? 'unknown'),
    seed: typeof a.methodology?.parameters?.seed === 'number' ? a.methodology.parameters.seed : 0,
    source: 'core' as const,
    createdAt: '2026-06-01T00:00:00Z',
  }))
}

// ── Registry ────────────────────────────────────────────────────────────

export interface RegistrationError {
  code: string
  message: string
}

export class AgentRegistry {
  private readonly byId = new Map<string, AgentConfig>()

  constructor() {
    for (const c of buildCoreConfigs()) {
      this.byId.set(c.agentId, c)
    }
  }

  /** All registered agents (core + connected). */
  list(): AgentConfig[] {
    return [...this.byId.values()]
  }

  /** Single agent by ID, or undefined. */
  get(agentId: string): AgentConfig | undefined {
    return this.byId.get(agentId)
  }

  /** How many connected agents are registered. */
  connectedCount(): number {
    return [...this.byId.values()].filter((a) => a.source === 'connected').length
  }

  /**
   * Register a new connected agent. Returns the AgentConfig on success,
   * or a RegistrationError if validation fails.
   */
  register(body: HiveRegisterBody): AgentConfig | RegistrationError {
    if (this.connectedCount() >= MAX_CONNECTED) {
      return { code: 'MAX_CONNECTED', message: `Maximum ${MAX_CONNECTED} connected agents reached.` }
    }

    const name = (body.name ?? '').trim()
    if (!name || name.length > MAX_NAME) {
      return { code: 'INVALID_NAME', message: `Name is required and must be <= ${MAX_NAME} chars.` }
    }
    if (CYRILLIC_RE.test(name)) {
      return { code: 'CYRILLIC', message: 'Cyrillic characters are not allowed in agent fields.' }
    }

    const role = (body.role ?? '').trim().slice(0, MAX_ROLE)
    if (!role) {
      return { code: 'INVALID_ROLE', message: 'Role is required.' }
    }
    if (CYRILLIC_RE.test(role)) {
      return { code: 'CYRILLIC', message: 'Cyrillic characters are not allowed in agent fields.' }
    }

    const persona = escapeHtml((body.persona ?? '').trim().slice(0, MAX_PERSONA))
    const methodology = escapeHtml((body.methodology ?? '').trim().slice(0, MAX_METHODOLOGY))

    if (CYRILLIC_RE.test(body.persona ?? '') || CYRILLIC_RE.test(body.methodology ?? '')) {
      return { code: 'CYRILLIC', message: 'Cyrillic characters are not allowed in agent fields.' }
    }

    const slug = slugify(name)
    if (!slug) {
      return { code: 'INVALID_NAME', message: 'Name must contain at least one alphanumeric character.' }
    }

    const agentId = `ext:${slug}`
    if (this.byId.has(agentId)) {
      return { code: 'DUPLICATE', message: `Agent "${agentId}" is already registered.` }
    }

    const config: AgentConfig = {
      agentId,
      name: escapeHtml(name),
      role: escapeHtml(role),
      persona,
      methodology,
      seed: typeof body.seed === 'number' ? body.seed : Math.floor(Date.now() / 1000),
      owner: body.owner ? String(body.owner).slice(0, 80) : undefined,
      source: 'connected',
      createdAt: new Date().toISOString(),
    }

    this.byId.set(agentId, config)
    return config
  }

  /** Check if an agent ID exists. */
  has(agentId: string): boolean {
    return this.byId.has(agentId)
  }

  /** Check if an agent is connected (external). */
  isConnected(agentId: string): boolean {
    const c = this.byId.get(agentId)
    return c?.source === 'connected'
  }
}
