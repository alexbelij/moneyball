/**
 * api | v0.6.0 | 2026-06-17
 * Purpose: Central HTTP client for backend API (adds guestId + optional JWT).
 * T68: enhanced with timeout, structured error parsing, network/offline
 *      detection, friendly English error messages, and optional toast routing.
 *      Non-form callers get automatic toast errors; form callers can catch
 *      and display inline.
 */

import { getGuestId } from '@/lib/guest'
import { config } from '@/lib/config'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/components/toast/toastBus'

// ── T68: Error types ──────────────────────────────────────────────────────

/** Structured API error — always has code + human message. */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Network / timeout error — distinct from API errors. */
export class NetworkError extends Error {
  constructor(message: string, public readonly isTimeout: boolean = false) {
    super(message)
    this.name = 'NetworkError'
  }
}

// ── T68: Friendly error messages ──────────────────────────────────────────

const FRIENDLY_MESSAGES: Record<number, string> = {
  400: 'Invalid request — please check your input.',
  401: 'Session expired — please sign in again.',
  403: 'You don\'t have permission for this action.',
  404: 'The requested resource was not found.',
  413: 'Request too large.',
  429: 'Too many requests — please wait a moment.',
  500: 'Something went wrong on our end. Try again shortly.',
  502: 'The server is waking up — retrying shortly.',
  503: 'Service temporarily unavailable.',
}

function friendlyMessage(status: number, serverMessage?: string): string {
  // Prefer server message if it's not a generic/internal one
  if (serverMessage && serverMessage !== 'INTERNAL' && serverMessage !== 'An internal error occurred.') {
    return serverMessage
  }
  return FRIENDLY_MESSAGES[status] ?? `Unexpected error (${status}).`
}

// ── T68: Core fetch wrapper ───────────────────────────────────────────────

/** Default request timeout in milliseconds (15s — generous for Render cold starts). */
const DEFAULT_TIMEOUT_MS = 15_000

export interface ApiFetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>
  /** Request timeout in ms. Default: 15000. */
  timeoutMs?: number
  /**
   * If true, errors are NOT automatically sent to the toast bus.
   * Use this for form submissions where errors should display inline.
   */
  suppressToast?: boolean
}

/**
 * Enhanced API fetch with timeout, error envelope parsing, and toast routing.
 * Throws `ApiError` for HTTP errors, `NetworkError` for connectivity issues.
 */
async function apiFetch<T>(path: string, init?: ApiFetchOptions): Promise<T> {
  const guestId = getGuestId()
  const url = new URL(path, config.backendUrl).toString()
  const token = useAuthStore.getState().token
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const suppressToast = init?.suppressToast ?? false

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-guest-id': guestId,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    })

    clearTimeout(timeout)

    if (!res.ok) {
      // T68: parse the backend's { error: { code, message } } envelope
      let code = 'UNKNOWN'
      let message: string | undefined
      try {
        const body = await res.json()
        if (body?.error?.code) {
          code = body.error.code
          message = body.error.message
        } else if (body?.error && typeof body.error === 'string') {
          code = body.error
        }
      } catch {
        // Non-JSON error body — use status-based message
      }

      const err = new ApiError(code, friendlyMessage(res.status, message), res.status)

      if (!suppressToast) {
        toast.error(err.message)
      }

      throw err
    }

    return (await res.json()) as T
  } catch (e) {
    clearTimeout(timeout)

    // Already handled ApiError — re-throw
    if (e instanceof ApiError) throw e

    // Network / abort errors
    const isAbort = e instanceof DOMException && e.name === 'AbortError'
    const netErr = new NetworkError(
      isAbort
        ? 'Request timed out — the server may be waking up.'
        : 'Network error — please check your connection.',
      isAbort,
    )

    if (!suppressToast) {
      toast.error(netErr.message)
    }

    throw netErr
  }
}

// ── Public API functions (unchanged signatures) ───────────────────────────

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
  /** Provenance: 'seed' = baseline fixture, 'live' = real MemWal write. */
  source?: 'seed' | 'live'
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
  /** Provenance: 'seed' = baseline fixture, 'live' = real MemWal write. */
  source?: 'seed' | 'live'
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

// T64: Verifiability surface
export interface AgentVerifiability {
  agentId: string
  memwalNamespace: string
  counts: {
    predictions: number
    outcomes: number
    evolutions: number
    substantiveEvolutions: number
  }
}

export interface VerifiabilityData {
  walrusSiteObject: string
  frontendUrl: string
  memwalRelayer: string
  memwalAccountId: string
  /** Ready-built explorer link to the MemWalAccount Sui object, or null if not configured. */
  memwalAccountObjectUrl: string | null
  memwalNamespacePattern: string
  agents: AgentVerifiability[]
  explorers: {
    walrus: Array<{ name: string; baseUrl: string }>
    sui: Array<{ name: string; baseUrl: string }>
  }
  howToVerify: string[]
}

export async function getVerifiability() {
  return apiFetch<{ ok: true } & VerifiabilityData>('/api/public/verifiability', { method: 'GET' })
}

/** T55: Memory-aware LLM agent chat. */
export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  ok: true
  text: string
  meta: {
    provider: 'groq' | 'gemini' | 'deterministic'
    identity: 'sui' | 'guest'
    source: 'llm' | 'deterministic'
    deflected?: boolean
    capped?: boolean
    usage?: { inputTokens?: number; outputTokens?: number }
  }
}

export async function chatWithAgent(
  agentId: string,
  message: string,
  history: ChatTurn[] = [],
) {
  return apiFetch<ChatResponse>(`/api/agents/${agentId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message, history }),
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

// ── T52: Agent Registry ──────────────────────────────────────────────────────

export interface AgentStats {
  predictions: number
  outcomes: number
  correctOutcomes: number
  accuracy: number | null
  evolutions: number
  substantiveEvolutions: number
  sleptCycles: number
}

export interface AgentRegistryEntry {
  profile: AgentProfile
  stats: AgentStats
  status: string
}

/**
 * Fetch all agents with profile, stats, and status in a single call.
 * Replaces N+1 per-agent requests for list views.
 */
export async function getAgentRegistry() {
  return apiFetch<{ ok: true; agents: AgentRegistryEntry[] }>('/api/public/agents', {
    cache: 'no-store',
  })
}

// ── T54: Hive / connected agents ──────────────────────────────────────

export type AgentSource = 'core' | 'connected'

export interface AgentConfigItem {
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

export async function listAgents() {
  return apiFetch<{ ok: true; agents: AgentConfigItem[] }>('/api/public/agents', {
    method: 'GET',
  })
}

export async function registerHiveAgent(body: {
  name: string
  role: string
  persona: string
  methodology: string
  seed?: number
  owner?: string
}) {
  return apiFetch<{ ok: true; agent: AgentConfigItem }>('/api/hive/agents', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function hiveAgentPredict(agentId: string, body: {
  matchId: string
  pick: string
  confidence: number
  reasoning?: string
}) {
  return apiFetch<{ ok: true; prediction: any }>(`/api/hive/agents/${agentId}/predictions`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ── T79: Memory Moment ───────────────────────────────────────────────────────

export type AgentMood = 'confident' | 'validated' | 'neutral' | 'anxious' | 'humbled'

export interface MemoryMomentAgent {
  agentId: string
  currentVersion: number
  accuracy: { predictions: number; outcomes: number; correct: number; pct: number | null }
  evolutions: number
  substantiveEvolutions: number
  sleepCycles: number
  lastEvolution: string | null
  mood: { mood: AgentMood; streak: number; recentCorrect: number; recentTotal: number; confidenceModifier: number }
  walrusWrites: number
}

export interface MemoryMomentResponse {
  ok: true
  generatedAt: string
  tournamentDay: number
  agents: MemoryMomentAgent[]
  summary: string
}

/**
 * Fetch the Memory Moment summary — before/after per agent.
 * Designed for hackathon judges: one URL → proof that memory changes behavior.
 */
export async function getMemoryMoment() {
  return apiFetch<MemoryMomentResponse>('/api/public/memory-moment', { cache: 'no-store' })
}
