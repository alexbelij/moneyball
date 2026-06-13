/**
 * api-stub | v1.1.0 | 2026-06-13
 * Purpose: Minimal Express stub mimicking the backend API for e2e tests.
 * T21: no real secrets or DB — returns static fixture data.
 * T26: added /profile so the AgentModal Method tab renders in e2e/preview.
 */

import express from 'express'

const app = express()
const PORT = 4001

const PROFILES: Record<string, unknown> = {
  dr_morgan: {
    id: 'dr_morgan',
    name: 'Dr. Morgan',
    role: 'Statistician',
    personality: 'Cold, pedantic, trusts only verifiable data.',
    catchphrases: ['Probabilities never lie.'],
    methodology: {
      type: 'weighted_metrics',
      formula: 'Score = (Home_xG * 0.4) + (Away_xG_Reverse * 0.3) + (Possession_Eff * 0.2)',
      description: null,
      parameters: { error_threshold: 1.5, learning_rate: 0.15, injury_weight_adjustment: 0.15 },
      evolutionTrigger:
        'If actual goal diff deviates from xG by more than 1.5, increase recent_defensive_injuries weight by 15%.',
      rules: [],
    },
  },
}

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
    paramsVersion: 1,
    outcome: { correct: true, resolvedAt: '2026-06-14T22:00:00Z' },
  },
  {
    agentId: 'dr_morgan',
    matchId: 'ger-fra-2026-06-15',
    pick: '2',
    confidence: 0.61,
    reasoning: 'Away xG edge.',
    createdAt: '2026-06-14T08:00:00Z',
    paramsVersion: 1,
    outcome: { correct: false, resolvedAt: '2026-06-15T22:00:00Z' },
  },
  {
    agentId: 'dr_morgan',
    matchId: 'esp-por-2026-06-16',
    pick: '1',
    confidence: 0.68,
    reasoning: 'Possession efficiency favours home.',
    createdAt: '2026-06-15T08:00:00Z',
    paramsVersion: 2,
    outcome: { correct: true, resolvedAt: '2026-06-16T22:00:00Z' },
  },
  {
    agentId: 'dr_morgan',
    matchId: 'arg-bra-2026-06-17',
    pick: 'X',
    confidence: 0.55,
    reasoning: 'Close matchup, draw likely.',
    createdAt: '2026-06-16T08:00:00Z',
    paramsVersion: 2,
    outcome: null,
  },
]

/* ── Routes ────────────────────────────────────────────────────── */

app.get('/api/public/agents', (_req, res) => {
  res.json({ agents: AGENTS })
})

app.get('/api/public/agents/:id/profile', (req, res) => {
  const profile = PROFILES[req.params.id]
  if (!profile) return res.status(404).json({ ok: false, error: 'UNKNOWN_AGENT' })
  res.json({ ok: true, profile })
})

app.get('/api/public/agents/:id/predictions', (req, res) => {
  const items = PREDICTIONS.filter((p) => p.agentId === req.params.id)
  res.json({ items })
})

const EVOLUTIONS: Record<string, unknown[]> = {
  dr_morgan: [
    {
      agentId: 'dr_morgan',
      createdAt: '2026-06-16T02:00:00Z',
      summary: 'Recalibrated after an xG miss.',
      fromVersion: 1,
      toVersion: 2,
      evolutionType: 'weight_tuning',
      parameterDiff: { injury_weight_adjustment: 0.15, confidenceBias: -0.03 },
    },
  ],
}

app.get('/api/public/agents/:id/evolution', (req, res) => {
  res.json({ items: EVOLUTIONS[req.params.id] ?? [] })
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
