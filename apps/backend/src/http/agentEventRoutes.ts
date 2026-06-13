/**
 * agentEventRoutes | v0.3.0 | 2026-06-14
 * Purpose: Public read + admin write for agent predictions/evolution.
 * T26: adds public /profile (identity + methodology, no secrets).
 * T40a: all async routes wrapped in asyncHandler (crash-guard).
 */

import type { Express } from 'express'
import { requireAdmin } from './jwtMiddleware'
import { asyncHandler } from './asyncHandler'
import { AgentEventService } from '../agents/agentEventService'
import { AgentProfileService } from '../agents/agentProfileService'

export function registerAgentEventRoutes(
  app: Express,
  svc: AgentEventService = new AgentEventService(),
  profiles: AgentProfileService = new AgentProfileService(),
) {

  // Public read
  app.get('/api/public/agents/:agentId/profile', (req, res) => {
    const agentId = String(req.params.agentId)
    const profile = profiles.get(agentId)
    if (!profile) return res.status(404).json({ ok: false, error: 'UNKNOWN_AGENT' })
    res.json({ ok: true, profile })
  })

  app.get('/api/public/agents/:agentId/predictions', asyncHandler(async (req, res) => {
    const agentId = String(req.params.agentId)
    const items = await svc.listPredictions(agentId, 30)
    res.json({ ok: true, agentId, items })
  }))

  app.get('/api/public/agents/:agentId/evolution', asyncHandler(async (req, res) => {
    const agentId = String(req.params.agentId)
    const items = await svc.listEvolution(agentId, 30)
    res.json({ ok: true, agentId, items })
  }))

  // Admin write
  app.post('/api/admin/agents/:agentId/predict', requireAdmin, asyncHandler(async (req, res) => {
    const agentId = String(req.params.agentId)
    const matchId = String(req.body?.matchId ?? 'WC26:demo-match')
    const pick = String(req.body?.pick ?? 'Draw')
    const confidence = Number(req.body?.confidence ?? 0.55)
    const reasoning = String(req.body?.reasoning ?? 'Demo prediction.')

    const ev = await svc.addPrediction({ agentId, matchId, pick, confidence, reasoning })
    res.json({ ok: true, ev })
  }))

  app.post('/api/admin/agents/:agentId/evolve', requireAdmin, asyncHandler(async (req, res) => {
    const agentId = String(req.params.agentId)
    const summary = String(req.body?.summary ?? 'Adjusted methodology after poor calibration.')
    const parameterDiff = (req.body?.parameterDiff ?? null) as any

    const ev = await svc.addEvolution({ agentId, summary, parameterDiff: parameterDiff ?? undefined })
    res.json({ ok: true, ev })
  }))
}
