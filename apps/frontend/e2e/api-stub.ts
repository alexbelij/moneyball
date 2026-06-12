/**
 * api-stub | v1.0.0 | 2026-06-13
 * Purpose: Minimal Express stub mimicking the backend API for e2e tests.
 * T21: no real secrets or DB — returns static fixture data.
 */

import express from 'express'

const app = express()
const PORT = 4001

/* ── Fixture data ──────────────────────────────────────────────── */

const AGENTS = [
  { agentId: 'dr_morgan', name: 'Dr. Morgan', role: 'Statistician', status: 'idle' },
  { agentId: 'scout_alvarez', name: 'Scout Alvarez', role: 'Field Scout', status: 'idle' },
  { agentId: 'viktor_kane', name: 'Viktor Kane', role: 'Analyst', status: 'idle' },
  { agentId: 'sofia_mendes', name: 'Sofia Mendes', role: 'Strategist', status: 'idle' },
  { agentId: 'madame_pythia', name: 'Madame Pythia', role: 'Oracle', status: 'idle' },
]

const PREDICTIONS = [
  {
    agentId: 'dr_morgan',
    matchId: 'usa-mex-2026-06-14',
    pick: '1',
    confidence: 0.72,
    reasoning: 'Home advantage + recent form.',
    createdAt: '2026-06-13T08:00:00Z',
    outcome: { correct: true, resolvedAt: '2026-06-14T22:00:00Z' },
  },
  {
    agentId: 'dr_morgan',
    matchId: 'arg-bra-2026-06-15',
    pick: 'X',
    confidence: 0.55,
    reasoning: 'Close matchup, draw likely.',
    createdAt: '2026-06-14T08:00:00Z',
    outcome: null,
  },
]

/* ── Routes ────────────────────────────────────────────────────── */

app.get('/api/public/agents', (_req, res) => {
  res.json({ agents: AGENTS })
})

app.get('/api/public/agents/:id/predictions', (req, res) => {
  const items = PREDICTIONS.filter((p) => p.agentId === req.params.id)
  res.json({ items })
})

app.get('/api/public/agents/:id/evolution', (_req, res) => {
  res.json({ items: [] })
})

app.get('/api/public/agents/:id/params', (req, res) => {
  res.json({
    params: {
      version: 1,
      confidenceBias: 0.02,
      hedgingLevel: 0.3,
      topicCalibration: {},
      updatedAt: '2026-06-13T08:00:00Z',
    },
  })
})

app.get('/api/public/matches', (_req, res) => {
  res.json({
    live: [],
    upcoming: [
      {
        id: 'usa-mex-2026-06-14',
        homeTeam: 'USA',
        awayTeam: 'Mexico',
        kickoffUtc: '2026-06-14T20:00:00Z',
        status: 'scheduled',
        result: null,
      },
    ],
    recent: [],
  })
})

app.post('/api/public/agents/:id/roast', (_req, res) => {
  res.json({ text: 'My models are sharper than your haircut.' })
})

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true }))

/* ── Start ──────────────────────────────────────────────────────── */

app.listen(PORT, () => {
  console.log(`[api-stub] listening on http://localhost:${PORT}`)
})
