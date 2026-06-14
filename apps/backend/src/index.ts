/**
 * backend entrypoint | v0.5.0 | 2026-06-14
 * Purpose: Express + Socket.io shared world + MemWal persistence + Sui auth + JWT.
 * T40a: global unhandledRejection/uncaughtException guards + Express error middleware.
 */

import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import http from 'node:http'
import { Server } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '@moneyball/shared/events'
import { env } from './config/env'
import { registerSocket } from './realtime/registerSocket'
import { InMemoryWorldStateStore } from './realtime/worldStateStore'
import { registerApiRoutes } from './http/apiRoutes'
import { registerAdminRoutes } from './http/adminRoutes'
import { registerAuthRoutes } from './http/authRoutes'
import { optionalJwt } from './http/jwtMiddleware'
import { registerAgentEventRoutes } from './http/agentEventRoutes'
import { registerMatchRoutes } from './http/matchRoutes'
import { AgentEventService } from './agents/agentEventService'
import { SleepService } from './agents/sleepService'
import { FootballDataProvider } from './matches/footballDataProvider'
import { ManualMatchProvider } from './matches/manualProvider'
import { MatchWorker } from './matches/matchWorker'
import type { AgentMethodology, MethodologyType } from './matches/predictionEngine'
import agentConfig from './agents/agent-config.v1.json'
import { AgentPersonaService } from './agents/agentPersonaService'
import type { ThoughtState } from './agents/agentPersonaService'

// ── T40a: global crash guards ──────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('[GLOBAL] unhandledRejection — process stays alive:', reason)
})

process.on('uncaughtException', (err) => {
  console.error('[GLOBAL] uncaughtException — process stays alive:', err)
})

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true
  if (env.CORS_ORIGINS.length === 0) return true
  return env.CORS_ORIGINS.includes(origin)
}

async function main() {
  const app = express()

  app.use(cors({
    origin: (origin, cb) => {
      if (isAllowedOrigin(origin)) return cb(null, true)
      return cb(new Error(`CORS blocked origin: ${origin}`), false)
    },
    credentials: false,
  }))
  app.use(express.json())

  // Auth routes (no JWT required)
  registerAuthRoutes(app)

  // Optional JWT for other /api routes
  app.use('/api', optionalJwt)

  app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }))
  app.get('/', (_req, res) => res.type('text').send('Moneyball backend: ok'))

  registerApiRoutes(app)
  const publicEvents = new AgentEventService()
  // T40b: best-effort hydrate from MemWal (non-blocking, won't crash on error)
  void publicEvents.hydrate([
    'dr_morgan', 'scout_alvarez', 'viktor_kane', 'sofia_mendes', 'madame_pythia',
  ])
  registerAgentEventRoutes(app, publicEvents)
  registerAdminRoutes(app)

  // ── T40a: Express error middleware (4 args — must come after all routes) ─
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('[express.error]', err)
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'INTERNAL' })
    }
  })

  const server = http.createServer(app)

  const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(server, {
    cors: {
      origin: (origin, cb) => {
        if (isAllowedOrigin(origin)) return cb(null, true)
        return cb(new Error(`Socket.io CORS blocked origin: ${origin}`), false)
      },
      credentials: false,
    },

    // Heartbeat tuning (prod-friendly)
    pingInterval: 15000,
    pingTimeout: 20000,

    // Optional safety guard (uncomment if you want a hard cap)
    // maxHttpBufferSize: 128 * 1024, // 128KB
  })

  const world = new InMemoryWorldStateStore('main')
  world.setAgents([
    { agentId: 'dr_morgan', name: 'Dr. Morgan', role: 'Statistician', status: 'idle', position: { x: 280, y: 520 } },
    { agentId: 'scout_alvarez', name: 'Scout Alvarez', role: 'Intuitionist', status: 'thinking', position: { x: 420, y: 540 } },
    { agentId: 'viktor_kane', name: 'Viktor Kane', role: 'Contrarian', status: 'idle', position: { x: 560, y: 525 } },
    { agentId: 'sofia_mendes', name: 'Sofia Mendes', role: 'Market Analyst', status: 'acting', position: { x: 700, y: 545 } },
    { agentId: 'madame_pythia', name: 'Madame Pythia', role: 'Tarot/Numerology', status: 'idle', position: { x: 860, y: 530 } }
  ])

  const socketApi = registerSocket(io, world)

  // ── Match pipeline: real WC2026 → predictions → outcomes → evolution ────
  const agents: AgentMethodology[] = (agentConfig as any).agents.map((a: any) => ({
    agentId: a.id as string,
    type: a.methodology.type as MethodologyType,
    parameters: (a.methodology.parameters ?? {}) as Record<string, number>,
  }))

  const sleepService = new SleepService(publicEvents)

  const manual = new ManualMatchProvider()
  const provider =
    env.MATCH_SOURCE === 'football-data' && env.FOOTBALL_DATA_TOKEN
      ? new FootballDataProvider(env.FOOTBALL_DATA_TOKEN)
      : manual

  const matchWorker = new MatchWorker(provider, agents, sleepService, {
    pollSeconds: env.MATCH_POLL_SECONDS,
    predictionLeadHours: env.PREDICTION_LEAD_HOURS,
    onThought: (agentId, text) => socketApi.broadcastThought(agentId, text),
  })
  matchWorker.start()

  registerMatchRoutes(app, {
    worker: matchWorker,
    manual,
    sleep: sleepService,
    agentIds: agents.map((a) => a.agentId),
  })

  // -- T45: ambient thought loop -- persona-sourced, 7-12s jitter ------
  const personaService = new AgentPersonaService()
  const AMBIENT_STATES: ThoughtState[] = ['analyzing', 'watching', 'coffee', 'arguing', 'busy']

  function scheduleNextThought() {
    const jitterMs = 7000 + Math.floor(Math.random() * 5000) // 7-12s
    setTimeout(() => {
      const agentList = world.getState().agents
      if (agentList.length === 0) { scheduleNextThought(); return }
      const pick = agentList[Math.floor(Math.random() * agentList.length)]
      const persona = personaService.get(pick.agentId)
      if (!persona) { scheduleNextThought(); return }
      const state = AMBIENT_STATES[Math.floor(Math.random() * AMBIENT_STATES.length)]
      const lines = persona.thoughtBubbles[state]
      if (lines.length === 0) { scheduleNextThought(); return }
      const text = lines[Math.floor(Math.random() * lines.length)]
      socketApi.broadcastThought(pick.agentId, text)
      scheduleNextThought()
    }, jitterMs)
  }
  scheduleNextThought()

  server.listen(env.PORT, () => {
    console.log(`[backend] listening on http://localhost:${env.PORT}`)
    console.log(`[backend] CORS_ORIGINS: ${env.CORS_ORIGINS.join(',') || '(allow all - dev)'}`)
  })
}

void main()
