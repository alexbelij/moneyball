/**
 * hive | v1.0.0 | 2026-06-17
 * Purpose: Shared types for the Agent Memory SDK / Hive registry (T52/T54).
 * Both backend + frontend + agent-sdk import these so wire-shapes stay aligned.
 */

/** Where the agent comes from. */
export type AgentSource = 'core' | 'connected'

/** Canonical agent config — shared between registry, API, and SDK. */
export interface AgentConfig {
  agentId: string
  name: string
  role: string
  persona: string
  methodology: string
  seed: number
  owner?: string
  source: AgentSource
  createdAt: string
}

/** Body for POST /api/hive/agents registration. */
export interface HiveRegisterBody {
  name: string
  role: string
  persona: string
  methodology: string
  seed?: number
  owner?: string
}

/** Body for POST /api/hive/agents/:id/predictions. */
export interface HivePredictionBody {
  matchId: string
  pick: string
  confidence: number
  reasoning?: string
}
