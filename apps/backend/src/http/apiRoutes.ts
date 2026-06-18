/**
 * apiRoutes | v0.4.0 | 2026-06-17
 * Purpose: User-facing API routes (identity, roasts, chat, data-source, thoughts).
 * T55: POST /api/agents/:id/chat — memory-aware LLM agent chat.
 * T40a: all async routes wrapped in asyncHandler (crash-guard).
 */

import type { Express } from 'express'
import { asyncHandler } from './asyncHandler'
import { getUserSummaryStore } from '../memory/storeFactory'
import { AgentPersonaService } from '../agents/agentPersonaService'
import { AgentProfileService } from '../agents/agentProfileService'
import { AgentEventService } from '../agents/agentEventService'
import { SleepService } from '../agents/sleepService'
import { getDataSourceSummary } from '../matches/dataSource'
import { env } from '../config/env'
import { buildLlmClient, buildAgentChatContext, filterTopic } from '../llm'
import { SimpleRateLimiter } from '../util/rateLimit'
import type { ChatTurn, LlmClient } from '../llm/types'

function getGuestId(req: any): string | null {
  const v = req.header('x-guest-id')
  if (!v || typeof v !== 'string') return null
  if (v.length < 10 || v.length > 80) return null
  return v
}

function getUserId(req: any): { userId: string; kind: 'sui' | 'guest' } | null {
  if (req.viewer?.suiAddress) return { userId: `sui:${String(req.viewer.suiAddress).toLowerCase()}`, kind: 'sui' }
  const guestId = getGuestId(req)
  if (guestId) return { userId: `guest:${guestId}`, kind: 'guest' }
  return null
}

// ── T55: daily cap tracking (in-memory, demo-grade) ────────────────────
function dayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

const dailyUsage = new Map<string, number>()
let currentDay = dayKey()

function getDailyCount(userId: string): number {
  const today = dayKey()
  if (today !== currentDay) {
    dailyUsage.clear()
    currentDay = today
  }
  return dailyUsage.get(userId) ?? 0
}

function incrementDailyCount(userId: string): void {
  const today = dayKey()
  if (today !== currentDay) {
    dailyUsage.clear()
    currentDay = today
  }
  dailyUsage.set(userId, (dailyUsage.get(userId) ?? 0) + 1)
}

export interface ApiRouteDeps {
  personas?: AgentPersonaService
  profiles?: AgentProfileService
  publicEvents?: AgentEventService
  sleepService?: SleepService
  llmClient?: LlmClient
}

export function registerApiRoutes(app: Express, deps: ApiRouteDeps = {}) {
  const personas = deps.personas ?? new AgentPersonaService()
  const profiles = deps.profiles ?? new AgentProfileService()

  // T55: LLM client (env-driven chain). Built once on registration.
  const llmClient = deps.llmClient ?? buildLlmClient({
    LLM_PRIMARY: env.LLM_PRIMARY,
    LLM_FALLBACK: env.LLM_FALLBACK,
    GROQ_API_KEY: env.GROQ_API_KEY,
    GROQ_MODEL: env.GROQ_MODEL,
    GEMINI_API_KEY: env.GEMINI_API_KEY,
    GEMINI_MODEL: env.GEMINI_MODEL,
    LLM_TIMEOUT_MS: env.LLM_TIMEOUT_MS,
    LLM_MAX_OUTPUT_TOKENS: env.LLM_MAX_OUTPUT_TOKENS,
  })

  // T55: rate limiter for chat (per-user min interval).
  const chatLimiter = new SimpleRateLimiter(env.LLM_USER_MIN_INTERVAL_MS)

  // ── Existing routes ─────────────────────────────────────────────────

  app.get('/api/me/summary', asyncHandler(async (req, res) => {
    const id = getUserId(req)
    if (!id) return res.status(401).json({ ok: false, error: 'MISSING_IDENTITY' })

    const store = getUserSummaryStore()
    const summary = await store.getOrCreate(id.userId)

    res.json({ ok: true, summary, meta: { storage: process.env.STORAGE_BACKEND ?? 'file', identity: id.kind } })
  }))

  app.post('/api/me/disagree', asyncHandler(async (req, res) => {
    const id = getUserId(req)
    if (!id) return res.status(401).json({ ok: false, error: 'MISSING_IDENTITY' })
    const agentId = String(req.body?.agentId ?? '')
    if (!agentId) return res.status(400).json({ ok: false, error: 'MISSING_AGENT_ID' })

    const store = getUserSummaryStore()
    const summary = await store.recordDisagree(id.userId, agentId)

    res.json({ ok: true, summary, meta: { storage: process.env.STORAGE_BACKEND ?? 'file', identity: id.kind } })
  }))

  app.post('/api/roast', asyncHandler(async (req, res) => {
    const id = getUserId(req)
    if (!id) return res.status(401).json({ ok: false, error: 'MISSING_IDENTITY' })
    const agentId = String(req.body?.agentId ?? '')
    if (!agentId) return res.status(400).json({ ok: false, error: 'MISSING_AGENT_ID' })

    const store = getUserSummaryStore()
    const summary = await store.getOrCreate(id.userId)
    const disagree = summary.agentDisagreeCounts[agentId] ?? 0

    const persona = personas.roastFor(agentId, id.userId)
    const text =
      persona ??
      (disagree === 0
        ? `Day 1 vibe: you haven't argued with me yet. Give it time.`
        : disagree < 3
          ? `I remember you argued with me (${disagree}x). That's… predictable.`
          : `You argue with me (${disagree}x). At this point it's your methodology, not mine.`)

    res.json({
      ok: true,
      text,
      meta: {
        disagree,
        source: persona ? 'persona' : 'generic',
        storage: process.env.STORAGE_BACKEND ?? 'file',
        identity: id.kind,
      },
    })
  }))

  // T30: honest provenance of the prediction engine's model inputs.
  app.get('/api/public/data-source', (_req, res) => {
    res.json({ ok: true, ...getDataSourceSummary() })
  })

  // T29: public thought bubbles for room cycling.
  app.get('/api/public/agents/:agentId/thoughts', (req, res) => {
    const agentId = String(req.params.agentId)
    const states = personas.thoughtsFor(agentId)
    if (!states) return res.status(404).json({ ok: false, error: 'UNKNOWN_AGENT' })
    res.json({ ok: true, agentId, states })
  })

  // ── T55: Memory-aware LLM agent chat ─────────────────────────────────

  app.post('/api/agents/:agentId/chat', asyncHandler(async (req, res) => {
    // 1. Identity check.
    const id = getUserId(req)
    if (!id) {
      return res.status(401).json({ ok: false, error: { code: 'MISSING_IDENTITY', message: 'Identity required. Send x-guest-id header or Bearer JWT.' } })
    }

    // 2. Validate input.
    const agentId = String(req.params.agentId ?? '')
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''
    if (!message) {
      return res.status(400).json({ ok: false, error: { code: 'MISSING_MESSAGE', message: 'Message is required.' } })
    }
    if (message.length > 1000) {
      return res.status(400).json({ ok: false, error: { code: 'MESSAGE_TOO_LONG', message: 'Message must be 1000 characters or less.' } })
    }

    // 3. Verify agent exists.
    const profile = profiles.get(agentId)
    if (!profile) {
      return res.status(404).json({ ok: false, error: { code: 'UNKNOWN_AGENT', message: `Agent "${agentId}" not found.` } })
    }

    // 4. Rate limit (per-user min interval).
    if (!chatLimiter.allow(id.userId)) {
      return res.status(429).json({ ok: false, error: { code: 'RATE_LIMITED', message: 'Please wait a moment before sending another message.' } })
    }

    // 5. Daily cap — over cap returns 200 with deterministic reply.
    const dailyCount = getDailyCount(id.userId)
    const capped = dailyCount >= env.LLM_DAILY_CAP_PER_USER

    // 6. Topic filter — off-topic → short-circuit with deterministic deflection.
    const deflection = filterTopic(message)
    if (deflection) {
      return res.json({
        ok: true,
        text: deflection,
        meta: { provider: 'deterministic', identity: id.kind, source: 'deterministic', deflected: true },
      })
    }

    // 7. Build context from deterministic data.
    const store = getUserSummaryStore()
    const userMemory = id.kind === 'sui' ? await store.getOrCreate(id.userId) : null

    // Fetch agent params — use sleepService if available, otherwise provide defaults.
    let params = { version: 0, confidenceBias: 0, hedgingLevel: 0.3, topicCalibration: {} as Record<string, { multiplier: number; sampleSize: number }> }
    if (deps.sleepService) {
      try {
        const p = await deps.sleepService.getParams(agentId)
        params = {
          version: p.version,
          confidenceBias: p.confidenceBias,
          hedgingLevel: p.hedgingLevel,
          topicCalibration: p.topicCalibration as any,
        }
      } catch { /* use defaults */ }
    }

    // Fetch recent predictions and evolution if events service available.
    let predictions: any[] = []
    let evolution: any[] = []
    if (deps.publicEvents) {
      try { predictions = await deps.publicEvents.listPredictions(agentId, 10) } catch { /* non-critical */ }
      try { evolution = await deps.publicEvents.listEvolution(agentId, 5) } catch { /* non-critical */ }
    }

    const systemPrompt = buildAgentChatContext({
      profile,
      params,
      predictions,
      evolution,
      userMemory,
      identityKind: id.kind,
    })

    // 8. Build message history (client-held, session-only, trimmed).
    const history: ChatTurn[] = []
    if (Array.isArray(req.body?.history)) {
      for (const turn of req.body.history.slice(-10)) {
        if (
          turn &&
          typeof turn.role === 'string' &&
          typeof turn.content === 'string' &&
          (turn.role === 'user' || turn.role === 'assistant')
        ) {
          history.push({ role: turn.role, content: turn.content.slice(0, 1000) })
        }
      }
    }
    history.push({ role: 'user', content: message })

    // 9. Complete via LLM chain (or deterministic if capped).
    let result
    if (capped) {
      // Over daily cap — use deterministic directly.
      const { DeterministicClient } = await import('../llm/deterministicClient')
      const deterministic = new DeterministicClient()
      result = await deterministic.complete({
        system: systemPrompt,
        messages: history,
        maxTokens: env.LLM_MAX_OUTPUT_TOKENS,
      })
    } else {
      result = await llmClient.complete({
        system: systemPrompt,
        messages: history,
        maxTokens: env.LLM_MAX_OUTPUT_TOKENS,
        temperature: 0.7,
      })
      incrementDailyCount(id.userId)
    }

    res.json({
      ok: true,
      text: result.text,
      meta: {
        provider: result.provider,
        identity: id.kind,
        source: result.provider === 'deterministic' ? 'deterministic' : 'llm',
        capped: capped || undefined,
        usage: result.usage,
      },
    })
  }))
}
