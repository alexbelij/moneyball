/**
 * matchRoutes | v0.2.0 | 2026-06-14
 * Purpose: Public match feed (TV/StatsBoard) + admin manual match control
 * (fallback provider, demo flow) + admin sleep trigger.
 * T40a: all async routes wrapped in asyncHandler (crash-guard).
 */

import type { Express } from 'express'
import { requireAdmin } from './jwtMiddleware'
import { asyncHandler } from './asyncHandler'
import type { MatchWorker } from '../matches/matchWorker'
import type { ManualMatchProvider } from '../matches/manualProvider'
import type { SleepService } from '../agents/sleepService'

export function registerMatchRoutes(
  app: Express,
  deps: {
    worker: MatchWorker
    manual: ManualMatchProvider | null
    sleep: SleepService
    agentIds: readonly string[]
  },
) {
  // ── Public ──────────────────────────────────────────────────────────────
  app.get('/api/public/matches', (_req, res) => {
    const all = deps.worker.listMatches()
    res.json({
      ok: true,
      live: all.filter((m) => m.status === 'live'),
      upcoming: all.filter((m) => m.status === 'scheduled').slice(0, 10),
      recent: all.filter((m) => m.status === 'finished').slice(-10).reverse(),
    })
  })

  app.get('/api/public/agents/:agentId/params', asyncHandler(async (req, res) => {
    const agentId = String(req.params.agentId)
    if (!deps.agentIds.includes(agentId)) {
      return res.status(404).json({ ok: false, error: 'UNKNOWN_AGENT' })
    }
    const params = await deps.sleep.getParams(agentId)
    res.json({ ok: true, params })
  }))

  // ── Admin: manual match control (works with any provider as a demo lane) ─
  app.post('/api/admin/matches', requireAdmin, asyncHandler(async (req, res) => {
    if (!deps.manual) return res.status(400).json({ ok: false, error: 'MANUAL_PROVIDER_DISABLED' })
    const homeTeam = String(req.body?.homeTeam ?? '').slice(0, 60)
    const awayTeam = String(req.body?.awayTeam ?? '').slice(0, 60)
    if (!homeTeam || !awayTeam) {
      return res.status(400).json({ ok: false, error: 'MISSING_TEAMS' })
    }
    const stage = req.body?.stage === 'knockout' ? 'knockout' : 'group'
    const match = deps.manual.create({
      homeTeam,
      awayTeam,
      stage,
      kickoffUtc: typeof req.body?.kickoffUtc === 'string' ? req.body.kickoffUtc : undefined,
    })
    deps.worker.upsert(match)
    void deps.worker.tick()
    res.json({ ok: true, match })
  }))

  app.post('/api/admin/matches/:id/resolve', requireAdmin, asyncHandler(async (req, res) => {
    if (!deps.manual) return res.status(400).json({ ok: false, error: 'MANUAL_PROVIDER_DISABLED' })
    const homeScore = Number(req.body?.homeScore)
    const awayScore = Number(req.body?.awayScore)
    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
      return res.status(400).json({ ok: false, error: 'BAD_SCORE' })
    }
    const match = deps.manual.resolve(String(req.params.id), homeScore, awayScore)
    if (!match) return res.status(404).json({ ok: false, error: 'UNKNOWN_MATCH' })
    deps.worker.upsert(match)
    await deps.worker.tick()
    res.json({ ok: true, match })
  }))

  app.post('/api/admin/agents/:agentId/sleep', requireAdmin, asyncHandler(async (req, res) => {
    const agentId = String(req.params.agentId)
    if (!deps.agentIds.includes(agentId)) {
      return res.status(404).json({ ok: false, error: 'UNKNOWN_AGENT' })
    }
    const result = await deps.sleep.runIfDue(agentId)
    res.json({ ok: true, result })
  }))
}
