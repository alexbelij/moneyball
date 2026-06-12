/**
 * agentEventRoutes | v0.1.0 | 2026-06-09
 * Purpose: Public read + admin write for agent predictions/evolution.
 */

import type { Express } from 'express'
import { requireAdmin } from './jwtMiddleware'
import { AgentEventService } from '../agents/agentEventService'

export function registerAgentEventRoutes(app: Express, svc: AgentEventService = new AgentEventService()) {

  // Public read
  app.get('/api/public/agents/:agentId/predictions', async (req, res) => {
    const agentId = String(req.params.agentId)
    const items = await svc.listPredictions(agentId, 30)
    res.json({ ok: true, agentId, items })
  })

  app.get('/api/public/agents/:agentId/evolution', async (req, res) => {
    const agentId = String(req.params.agentId)
    const items = await svc.listEvolution(agentId, 30)
    res.json({ ok: true, agentId, items })
  })

  // Admin write
  app.post('/api/admin/agents/:agentId/predict', requireAdmin, async (req, res) => {
    const agentId = String(req.params.agentId)
    const matchId = String(req.body?.matchId ?? 'WC26:demo-match')
    const pick = String(req.body?.pick ?? 'Draw')
    const confidence = Number(req.body?.confidence ?? 0.55)
    const reasoning = String(req.body?.reasoning ?? 'Demo prediction.')

    const ev = await svc.addPrediction({ agentId, matchId, pick, confidence, reasoning })
    res.json({ ok: true, ev })
  })

  app.post('/api/admin/agents/:agentId/evolve', requireAdmin, async (req, res) => {
    const agentId = String(req.params.agentId)
    const summary = String(req.body?.summary ?? 'Adjusted methodology after poor calibration.')
    const parameterDiff = (req.body?.parameterDiff ?? null) as any

    const ev = await svc.addEvolution({ agentId, summary, parameterDiff: parameterDiff ?? undefined })
    res.json({ ok: true, ev })
  })
}
