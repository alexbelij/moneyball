/**
 * agentEventRoutes | v0.4.0 | 2026-06-17
 * Purpose: Public read + admin write for agent predictions/evolution.
 * T26: adds public /profile (identity + methodology, no secrets).
 * T40a: all async routes wrapped in asyncHandler (crash-guard).
 * T57: evolution endpoint filters noop by default (?includeNoops=1 for debug);
 *      profile endpoint includes slept/evolved activity counter.
 */

import type { Express } from 'express'
import { requireAdmin } from './jwtMiddleware'
import { asyncHandler } from './asyncHandler'
import { AgentEventService } from '../agents/agentEventService'
import { AgentProfileService } from '../agents/agentProfileService'
import type { AgentRegistry } from '../agents/agentRegistry'

export function registerAgentEventRoutes(
  app: Express,
  svc: AgentEventService = new AgentEventService(),
  profiles: AgentProfileService = new AgentProfileService(),
  registry?: AgentRegistry | null,
) {

  // T52: Agent Registry — all agents in one call
  if (registry) {
    app.get('/api/public/agents', (_req, res) => {
      res.json({ ok: true, agents: registry.list() })
    })
  }

  // Public read
  app.get('/api/public/agents/:agentId/profile', (req, res) => {
    const agentId = String(req.params.agentId)
    const profile = profiles.get(agentId)
    if (!profile) return res.status(404).json({ ok: false, error: 'UNKNOWN_AGENT' })
    // T57: slept/evolved counter — liveness feel without noise in the panel
    const totalEvolutions = svc.evolutionCount(agentId)
    const substantiveEvolutions = svc.substantiveEvolutionCount(agentId)
    const slept = totalEvolutions - substantiveEvolutions // noop sleep cycles
    res.json({
      ok: true,
      profile,
      activity: { slept, evolved: substantiveEvolutions },
    })
  })

  app.get('/api/public/agents/:agentId/predictions', asyncHandler(async (req, res) => {
    const agentId = String(req.params.agentId)
    const items = await svc.listPredictions(agentId, 30)
    res.json({ ok: true, agentId, items })
  }))

  app.get('/api/public/agents/:agentId/evolution', asyncHandler(async (req, res) => {
    const agentId = String(req.params.agentId)
    const includeNoops = req.query.includeNoops === '1'
    const all = await svc.listEvolution(agentId, 30)
    // T57: default = substantive only (noop hidden); ?includeNoops=1 for debug
    const items = includeNoops
      ? all
      : all.filter((e) => e.evolutionType !== 'noop' && Object.keys(e.parameterDiff ?? {}).length > 0)
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
