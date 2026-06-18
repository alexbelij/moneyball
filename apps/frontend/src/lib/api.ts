/**
 * api | v0.5.0 | 2026-06-12
 * Purpose: Central HTTP client for backend API (adds guestId + optional JWT).
 */

import { getGuestId } from '@/lib/guest'
import { config } from '@/lib/config'
import { useAuthStore } from '@/store/authStore'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const guestId = getGuestId()
  const url = new URL(path, config.backendUrl).toString()
  const token = useAuthStore.getState().token

  const res = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-guest-id': guestId,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  return (await res.json()) as T
}

// User interactions
export async function roast(agentId: string) {
  return apiFetch<{ ok: true; text: string; meta?: any }>('/api/roast', {
    method: 'POST',
    body: JSON.stringify({ agentId }),
  })
}

export async function disagree(agentId: string) {
  return apiFetch<{ ok: true; summary: any; meta?: any }>('/api/me/disagree', {
    method: 'POST',
    body: JSON.stringify({ agentId }),
  })
}

export async function getMeSummary() {
  return apiFetch<{ ok: true; summary: any; meta?: any }>('/api/me/summary', { method: 'GET' })
}

// Public agent events (shapes mirror backend agentEventService v0.2)
export interface PredictionItem {
  agentId: string
  createdAt: string
  matchId: string
  pick: string
  confidence: number
  reasoning: string
  predictionId?: string
  paramsVersion?: number
  /** T76: Walrus blob_id for on-chain verification. */
  blobId?: string
  outcome?: { correct: boolean; resolvedAt: string }
}

export interface EvolutionItem {
  agentId: string
  createdAt: string
  summary: string
  parameterDiff?: Record<string, number>
  fromVersion?: number
  toVersion?: number
  evolutionType?: string
  /** T76: Walrus blob_id for on-chain verification. */
  blobId?: string
}

export interface MatchInfo {
  id: string
  homeTeam: string
  awayTeam: string
  kickoffUtc: string
  stage: 'group' | 'knockout'
  status: 'scheduled' | 'live' | 'finished'
  result: { homeScore: number; awayScore: number; outcome: '1' | 'X' | '2' } | null
}

// Public agent profile (methodology dossier — T26). Shape mirrors backend
// agentProfileService.PublicAgentProfile.
export interface MethodologyRule {
  name: string
  logic: string
  effect: string
}

export interface AgentMethodology {
  type: string
  formula: string | null
  description: string | null
  parameters: Record<string, number>
  evolutionTrigger: string | null
  rules: MethodologyRule[]
}

export interface AgentProfile {
  id: string
  name: string
  role: string
  personality: string
  catchphrases: string[]
  methodology: AgentMethodology
}

export async function getAgentProfile(agentId: string) {
  return apiFetch<{ ok: true; profile: AgentProfile }>(`/api/public/agents/${agentId}/profile`, {
    method: 'GET',
  })
}

export async function getAgentPredictions(agentId: string) {
  return apiFetch<{ ok: true; agentId: string; items: PredictionItem[] }>(`/api/public/agents/${agentId}/predictions`, {
    method: 'GET',
  })
}

export async function getAgentEvolution(agentId: string) {
  return apiFetch<{ ok: true; agentId: string; items: EvolutionItem[] }>(`/api/public/agents/${agentId}/evolution`, {
    method: 'GET',
  })
}

/** T30: honest provenance of the prediction engine's model inputs. */
export type InputSource = 'synthetic' | 'manual' | 'live'
export interface ModelInputField {
  key: string
  label: string
  source: InputSource
  detail: string
}
export interface DataSourceSummary {
  version: number
  headline: string
  inputs: ModelInputField[]
}

export async function getDataSource() {
  return apiFetch<{ ok: true } & DataSourceSummary>('/api/public/data-source', { method: 'GET' })
}

/** Thought-bubble states → flavour lines, for room cycling (T29). */
export type AgentThoughtStates = Record<string, string[]>

export async function getAgentThoughts(agentId: string) {
  return apiFetch<{ ok: true; agentId: string; states: AgentThoughtStates }>(
    `/api/public/agents/${agentId}/thoughts`,
    { method: 'GET' },
  )
}

export interface AgentParamsInfo {
  agentId: string
  version: number
  confidenceBias: number
  hedgingLevel: number
  topicCalibration: Record<string, number>
  updatedAt?: string
  sourceEvolutionEventId?: string | null
}

export async function getAgentParams(agentId: string) {
  return apiFetch<{ ok: true; params: AgentParamsInfo | null }>(`/api/public/agents/${agentId}/params`, {
    method: 'GET',
  })
}

export async function getMatches() {
  return apiFetch<{ ok: true; live: MatchInfo[]; upcoming: MatchInfo[]; recent: MatchInfo[] }>('/api/public/matches', {
    method: 'GET',
  })
}

// Admin agent events (JWT-admin required)
export async function adminAgentPredict(agentId: string, input: {
  matchId: string
  pick: string
  confidence: number
  reasoning: string
}) {
  return apiFetch<{ ok: true; ev: any }>(`/api/admin/agents/${agentId}/predict`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function adminAgentEvolve(agentId: string, input: {
  summary: string
  parameterDiff?: Record<string, number>
}) {
  return apiFetch<{ ok: true; ev: any }>(`/api/admin/agents/${agentId}/evolve`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function adminDayPlusOne(agentId: string) {
  return apiFetch<{ ok: true; summary: any; meta?: any }>('/api/admin/simulate/day-plus-one', {
    method: 'POST',
    body: JSON.stringify({ agentId }),
  })
}
