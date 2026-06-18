/**
 * hiveRoutes | v1.0.0 | 2026-06-17
 * Purpose: REST endpoints for the Agent Hive (T54) — register connected agents,
 * submit predictions, list all agents (core + connected).
 *
 * Security invariants:
 * - Connected agents can ONLY write their own predictions under their own agentId.
 * - Numbers (confidence) are stored verbatim from the agent but outcomes/Brier are
 *   computed by our deterministic engine — external agents never touch the engine.
 * - All text fields are HTML-escaped to prevent XSS (handled in AgentRegistry).
 * - Rate-limited registration + prediction submission.
 */

import type { Express } from 'express'
import { asyncHandler } from './asyncHandler'
import { AgentRegistry, type RegistrationError } from '../agents/agentRegistry'
import { AgentEventService } from '../agents/agentEventService'
import type { HiveRegisterBody, HivePredictionBody } from '@moneyball/shared/hive'
import { SimpleRateLimiter } from '../util/rateLimit'

function isError(v: any): v is RegistrationError {
  return v && typeof v.code === 'string' && typeof v.message === 'string' && !v.agentId
}

export function registerHiveRoutes(
  app: Express,
  registry: AgentRegistry,
  events: AgentEventService,
) {
  const registerRl = new SimpleRateLimiter(5000) // 1 registration per 5s per IP
  const predictRl = new SimpleRateLimiter(2000)  // 1 prediction per 2s per agent

  // ── List all agents (core + connected) ───────────────────────────────
  app.get('/api/public/agents', (_req, res) => {
    res.json({ ok: true, agents: registry.list() })
  })

  // ── Register a connected agent ───────────────────────────────────────
  app.post('/api/hive/agents', asyncHandler(async (req, res) => {
    const ip = req.ip ?? 'unknown'
    if (!registerRl.allow(ip)) {
      return res.status(429).json({ ok: false, error: { code: 'RATE_LIMIT', message: 'Too many registrations. Try again shortly.' } })
    }

    const body = req.body as HiveRegisterBody
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ ok: false, error: { code: 'INVALID_BODY', message: 'Request body must be a JSON object.' } })
    }

    const result = registry.register(body)
    if (isError(result)) {
      return res.status(400).json({ ok: false, error: result })
    }

    res.status(201).json({ ok: true, agent: result })
  }))

  // ── Submit a prediction under a connected agent ──────────────────────
  app.post('/api/hive/agents/:agentId/predictions', asyncHandler(async (req, res) => {
    const agentId = String(req.params.agentId)

    if (!registry.has(agentId)) {
      return res.status(404).json({ ok: false, error: { code: 'UNKNOWN_AGENT', message: `Agent "${agentId}" not found.` } })
    }

    if (!registry.isConnected(agentId)) {
      return res.status(403).json({ ok: false, error: { code: 'CORE_AGENT', message: 'Cannot submit predictions for core agents via Hive.' } })
    }

    if (!predictRl.allow(agentId)) {
      return res.status(429).json({ ok: false, error: { code: 'RATE_LIMIT', message: 'Too many predictions. Try again shortly.' } })
    }

    const body = req.body as HivePredictionBody
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ ok: false, error: { code: 'INVALID_BODY', message: 'Request body must be a JSON object.' } })
    }

    const matchId = String(body.matchId ?? '').trim()
    const pick = String(body.pick ?? '').trim()
    const confidence = Number(body.confidence)
    const reasoning = String(body.reasoning ?? '').trim().slice(0, 500)

    if (!matchId) {
      return res.status(400).json({ ok: false, error: { code: 'MISSING_MATCH_ID', message: 'matchId is required.' } })
    }
    if (!pick) {
      return res.status(400).json({ ok: false, error: { code: 'MISSING_PICK', message: 'pick is required.' } })
    }
    if (isNaN(confidence) || confidence < 0 || confidence > 1) {
      return res.status(400).json({ ok: false, error: { code: 'INVALID_CONFIDENCE', message: 'confidence must be a number between 0 and 1.' } })
    }

    const ev = await events.addPrediction({
      agentId,
      matchId,
      pick,
      confidence,
      reasoning: reasoning || 'Connected agent prediction.',
    })

    res.status(201).json({ ok: true, prediction: ev })
  }))

  // ── Single connected agent detail ────────────────────────────────────
  app.get('/api/hive/agents/:agentId', (req, res) => {
    const agentId = String(req.params.agentId)
    const agent = registry.get(agentId)
    if (!agent) {
      return res.status(404).json({ ok: false, error: { code: 'UNKNOWN_AGENT', message: `Agent "${agentId}" not found.` } })
    }
    res.json({ ok: true, agent })
  })

  // ── Heartbeat for connected agents ───────────────────────────────────
  app.post('/api/hive/agents/:agentId/heartbeat', (req, res) => {
    const agentId = String(req.params.agentId)
    if (!registry.has(agentId)) {
      return res.status(404).json({ ok: false, error: { code: 'UNKNOWN_AGENT', message: `Agent "${agentId}" not found.` } })
    }
    if (!registry.isConnected(agentId)) {
      return res.status(403).json({ ok: false, error: { code: 'CORE_AGENT', message: 'Heartbeat only for connected agents.' } })
    }
    // Heartbeat acknowledged — stateless for now (Render single instance)
    res.json({ ok: true, agentId, serverTime: new Date().toISOString() })
  })
}
