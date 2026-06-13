/**
 * seed-demo | v1.0.0 | 2026-06-14
 * Purpose: ONE idempotent command that drives the admin-API to produce a full
 * day1→dayN before/after state for demo purposes (T42). Used by the lead to
 * seed a judge-ready experience on prod.
 *
 * Usage: pnpm seed:demo                          (default: http://localhost:4000)
 *        BASE_URL=https://api.example.com pnpm seed:demo
 *
 * Requires: JWT_SECRET env var (same as backend) to mint admin tokens.
 * If JWT_SECRET is not set, falls back to 'dev-insecure-secret-change-me'.
 */

import jwt from 'jsonwebtoken'

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4000'
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me'
const ADMIN_ADDRESS = '0xadmin_seeder'

const AGENTS = [
  'dr_morgan',
  'scout_alvarez',
  'viktor_kane',
  'sofia_mendes',
  'madame_pythia',
] as const

// World Cup group stage matches with realistic teams
const MATCHES = [
  { homeTeam: 'Brazil', awayTeam: 'Serbia', stage: 'group' as const, homeScore: 2, awayScore: 0 },
  { homeTeam: 'Germany', awayTeam: 'Japan', stage: 'group' as const, homeScore: 1, awayScore: 2 },
  { homeTeam: 'Argentina', awayTeam: 'Saudi Arabia', stage: 'group' as const, homeScore: 1, awayScore: 2 },
  { homeTeam: 'Spain', awayTeam: 'Costa Rica', stage: 'group' as const, homeScore: 7, awayScore: 0 },
  { homeTeam: 'France', awayTeam: 'Denmark', stage: 'group' as const, homeScore: 2, awayScore: 1 },
  { homeTeam: 'England', awayTeam: 'USA', stage: 'group' as const, homeScore: 0, awayScore: 0 },
  { homeTeam: 'Portugal', awayTeam: 'Ghana', stage: 'group' as const, homeScore: 3, awayScore: 2 },
  { homeTeam: 'Netherlands', awayTeam: 'Senegal', stage: 'group' as const, homeScore: 2, awayScore: 0 },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function mintAdminToken(): string {
  return jwt.sign({ sub: ADMIN_ADDRESS, role: 'admin' }, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
  })
}

async function api<T = any>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
  token?: string,
): Promise<T> {
  const url = `${BASE_URL}${path}`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '<no body>')
    throw new Error(`${method} ${path} → ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ── Seed pipeline ─────────────────────────────────────────────────────────────
async function seedDemo() {
  console.log(`[seed-demo] target: ${BASE_URL}`)

  // 1. Health check
  const health = await api('GET', '/health')
  console.log(`[seed-demo] health: ${JSON.stringify(health)}`)

  const token = mintAdminToken()
  console.log(`[seed-demo] admin token minted for ${ADMIN_ADDRESS}`)

  // 2. Create matches, trigger predictions (matchWorker.tick runs on create)
  const matchIds: string[] = []
  for (const m of MATCHES) {
    console.log(`\n[seed-demo] ── ${m.homeTeam} vs ${m.awayTeam} ──`)
    const createRes = await api<{ ok: boolean; match: { id: string } }>(
      'POST',
      '/api/admin/matches',
      { homeTeam: m.homeTeam, awayTeam: m.awayTeam, stage: m.stage },
      token,
    )
    const matchId = createRes.match.id
    matchIds.push(matchId)
    console.log(`  created: ${matchId}`)

    // Small delay to let predictions propagate
    await sleep(500)

    // 3. Resolve match → triggers outcomes + potential sleep/evolution
    const resolveRes = await api<{ ok: boolean }>(
      'POST',
      `/api/admin/matches/${matchId}/resolve`,
      { homeScore: m.homeScore, awayScore: m.awayScore },
      token,
    )
    console.log(`  resolved: ${m.homeScore}-${m.awayScore} (ok=${resolveRes.ok})`)

    await sleep(500)
  }

  // 4. Trigger sleep cycle for all agents (forces evolution if due)
  console.log('\n[seed-demo] ── triggering sleep cycles ──')
  for (const agentId of AGENTS) {
    try {
      const sleepRes = await api<{ ok: boolean; result: { kind: string } }>(
        'POST',
        `/api/admin/agents/${agentId}/sleep`,
        {},
        token,
      )
      console.log(`  ${agentId}: sleep → ${sleepRes.result?.kind ?? 'unknown'}`)
    } catch (e: any) {
      console.warn(`  ${agentId}: sleep failed (${e.message})`)
    }
    await sleep(300)
  }

  // 5. Add explicit evolution events for before/after demonstration
  console.log('\n[seed-demo] ── adding explicit evolution snapshots ──')
  const evolutions: Array<{
    agentId: string
    summary: string
    parameterDiff: Record<string, number>
  }> = [
    {
      agentId: 'dr_morgan',
      summary: 'Day 2 recalibration: Japan upset exposed over-reliance on historical xG. Reduced confidence bias, increased weight on recent defensive form.',
      parameterDiff: { confidenceBias: -0.08, hedgingLevel: 0.05, recentFormWeight: 0.10 },
    },
    {
      agentId: 'scout_alvarez',
      summary: 'Day 3 gut check: three upsets in a row. My instinct was right on Japan but wrong on Argentina. Adjusting narrative weight down, trusting squad depth data more.',
      parameterDiff: { narrativeWeight: -0.12, squadDepthWeight: 0.08, confidenceBias: -0.05 },
    },
    {
      agentId: 'viktor_kane',
      summary: 'Day 2 contrarian review: fading every favourite worked once (Japan), failed once (Spain 7-0). Need to distinguish genuine contrarian value from blind fading.',
      parameterDiff: { contrarianism: -0.10, hedgingLevel: 0.07, publicSentimentWeight: 0.05 },
    },
    {
      agentId: 'sofia_mendes',
      summary: 'Day 3 market update: early tournament lines are wild, my edge was strongest where I trusted small-market signals. Increasing confidence on lines that move without news.',
      parameterDiff: { marketEfficiency: 0.06, confidenceBias: 0.03, lineMovementWeight: 0.12 },
    },
    {
      agentId: 'madame_pythia',
      summary: 'Day 2 cosmic recalibration: the stars were clear on Japan (numerology hit) but Saturn interfered with the Argentina reading. Adjusting planetary weight modifiers.',
      parameterDiff: { mysticismIntensity: -0.05, planetaryAlignment: 0.08, numerologyBias: -0.03 },
    },
  ]

  for (const evo of evolutions) {
    const evoRes = await api<{ ok: boolean }>(
      'POST',
      `/api/admin/agents/${evo.agentId}/evolve`,
      { summary: evo.summary, parameterDiff: evo.parameterDiff },
      token,
    )
    console.log(`  ${evo.agentId}: evolve → ok=${evoRes.ok}`)
    await sleep(300)
  }

  // Add a second wave of evolution (day 4-5 feel)
  console.log('\n[seed-demo] ── day 4-5 evolution wave ──')
  const wave2: typeof evolutions = [
    {
      agentId: 'dr_morgan',
      summary: 'Day 5 deep review: Brier score improved 12% after Day 2 recalibration. Defensive injury data proving reliable. Narrowing confidence bands on knockout-stage picks.',
      parameterDiff: { confidenceBias: 0.03, topicCalibration: 0.06, hedgingLevel: -0.03 },
    },
    {
      agentId: 'scout_alvarez',
      summary: 'Day 5 trust shift: two more upsets confirmed — squad depth is the real signal this tournament. Narrative weight fully recalibrated. Feeling sharper.',
      parameterDiff: { narrativeWeight: -0.05, squadDepthWeight: 0.06, confidenceBias: 0.04 },
    },
    {
      agentId: 'viktor_kane',
      summary: 'Day 4 edge sharpening: selective contrarianism is working. When public sentiment exceeds 75%, fading still profitable. Below that, I agree with the crowd now.',
      parameterDiff: { contrarianism: 0.04, publicSentimentThreshold: 0.10, hedgingLevel: -0.04 },
    },
  ]

  for (const evo of wave2) {
    const evoRes = await api<{ ok: boolean }>(
      'POST',
      `/api/admin/agents/${evo.agentId}/evolve`,
      { summary: evo.summary, parameterDiff: evo.parameterDiff },
      token,
    )
    console.log(`  ${evo.agentId}: evolve wave2 → ok=${evoRes.ok}`)
    await sleep(300)
  }

  // 6. Verify end state
  console.log('\n[seed-demo] ── verifying end state ──')
  let allGood = true

  // Check matches
  const matchList = await api<{ ok: boolean; recent: any[] }>('GET', '/api/public/matches')
  const finishedCount = matchList.recent?.length ?? 0
  console.log(`  matches: ${finishedCount} finished`)
  if (finishedCount < MATCHES.length) {
    console.error(`  ✗ expected >= ${MATCHES.length} finished matches, got ${finishedCount}`)
    allGood = false
  }

  // Check evolution per agent
  for (const agentId of AGENTS) {
    const evoRes = await api<{ ok: boolean; items: any[] }>(
      'GET',
      `/api/public/agents/${agentId}/evolution`,
    )
    const evoCount = evoRes.items?.length ?? 0
    const predsRes = await api<{ ok: boolean; items: any[] }>(
      'GET',
      `/api/public/agents/${agentId}/predictions`,
    )
    const predCount = predsRes.items?.length ?? 0
    const mark = evoCount >= 1 ? '✓' : '✗'
    console.log(`  ${mark} ${agentId}: ${evoCount} evolution entries, ${predCount} predictions`)
    if (evoCount < 1) allGood = false
  }

  // Check data-source
  const ds = await api<{ ok: boolean }>('GET', '/api/public/data-source')
  console.log(`  data-source: ok=${ds.ok}`)

  console.log(`\n[seed-demo] ${allGood ? '✅ SEED COMPLETE — judge-ready state' : '⚠️  SEED PARTIAL — check warnings above'}`)
  if (!allGood) process.exit(1)
}

seedDemo().catch((err) => {
  console.error('[seed-demo] FATAL:', err)
  process.exit(1)
})
