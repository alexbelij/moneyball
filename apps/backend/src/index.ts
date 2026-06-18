/**
 * backend entrypoint | v0.6.0 | 2026-06-17
 * Purpose: Express + Socket.io shared world + MemWal persistence + Sui auth + JWT.
 * T40a: global unhandledRejection/uncaughtException guards + Express error middleware.
 * T56: security hardening — helmet, body-size limit, strict CORS for mutations,
 *      consistent error envelope (never leak stack traces).
 */

import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
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
import { AgentRegistry } from './agents/agentRegistry'
import { hasSeedBaseline, seedReadModel } from './agents/seedReadModel'
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

// ── T56: CORS helpers ──────────────────────────────────────────────────
// Read-only GETs are allowed without Origin (curl, health checks, etc.).
// Mutating methods (POST/PUT/PATCH/DELETE) from a browser MUST send an Origin
// matching the allowlist — reject if missing or unrecognised.
// In dev (empty CORS_ORIGINS) all origins are allowed.
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true
  if (env.CORS_ORIGINS.length === 0) return true
  return env.CORS_ORIGINS.includes(origin)
}

async function main() {
  const app = express()

  // ── T56: helmet — standard security headers ────────────────────────────
  // CSP is set to allow the Walrus-hosted frontend, the backend itself for
  // API/WS, and inline pixel styles (the SNES UI relies on them).
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],  // pixel inline styles
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'wss:', 'ws:'],    // Socket.io
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    // HSTS is handled by Render's edge; avoid double headers
    hsts: env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false,  // breaks cross-origin font/image loads
  }))

  app.use(cors({
    origin: (origin, cb) => {
      if (isAllowedOrigin(origin)) return cb(null, true)
      return cb(new Error(`CORS blocked origin: ${origin}`), false)
    },
    credentials: false,
  }))

  // T56: reject no-Origin mutating requests when an allowlist is configured.
  // Browsers always send Origin on POST/etc. No-Origin mutations come from
  // curl/scripts — legitimate in dev, suspect in prod.
  app.use((req, res, next) => {
    if (
      env.CORS_ORIGINS.length > 0 &&
      MUTATING_METHODS.has(req.method) &&
      !req.headers.origin
    ) {
      return res.status(403).json({
        error: { code: 'ORIGIN_REQUIRED', message: 'Origin header required for mutating requests.' },
      })
    }
    next()
  })

  // T56: body-size limits — payloads are tiny (predictions, roasts, auth).
  // Oversized bodies → 413 (Express default behaviour with limit set).
  app.use(express.json({ limit: '64kb' }))
  app.use(express.urlencoded({ extended: false, limit: '64kb' }))

  // Auth routes (no JWT required)
  registerAuthRoutes(app)

  // Optional JWT for other /api routes
  app.use('/api', optionalJwt)

  registerApiRoutes(app)

  const SEED_AGENTS = ['dr_morgan', 'scout_alvarez', 'viktor_kane', 'sofia_mendes', 'madame_pythia']
  const publicEvents = new AgentEventService()

  // ── T57: durable read-model on a cold start ──────────────────────────────
  // The on-disk index is ephemeral (wiped on redeploy) and MemWal recall is
  // best-effort top-K (no full enumeration). So: (1) await a wide hydrate from
  // MemWal to restore whatever durable history we can, then (2) deterministically
  // rebuild the demo baseline from the committed fixture if it's missing — no
  // manual re-seed ritual. Both are idempotent (dedup by predictionId / runId).
  // Bounded await: a hung MemWal relayer must never block the server from
  // listening — we fall back to the deterministic rebuild below regardless.
  await Promise.race([
    publicEvents.hydrate(SEED_AGENTS).catch((err) => console.error('[boot.hydrate] failed (non-fatal):', err)),
    new Promise<void>((r) => setTimeout(r, 15000)),
  ])
  try {
    if (!(await hasSeedBaseline(publicEvents))) {
      const r = await seedReadModel(publicEvents)
      console.log('[boot.seed] read-model rebuilt from fixture:', r)
    } else {
      console.log('[boot.seed] read-model baseline already present — skipped rebuild')
    }
  } catch (err) {
    console.error('[boot.seed] read-model rebuild failed (non-fatal):', err)
  }

  // T57: /health reports read-model readiness so a redeploy can be verified
  // without a manual re-seed. Backwards compatible: keeps { ok, ts }.
  app.get('/health', (_req, res) =>
    res.json({ ok: true, ts: new Date().toISOString(), readModel: publicEvents.readinessReport(SEED_AGENTS) }),
  )
  app.get('/', (_req, res) => res.type('text').send('Moneyball backend: ok'))

  // T52: Agent routes registered after world state init (below)
  registerAdminRoutes(app)

  // ── T40a+T56: Express error middleware (4 args — must come after all routes)
  // Returns a consistent { error: { code, message } } envelope.
  // Never leaks stack traces to the client.
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('[express.error]', err)
    if (!res.headersSent) {
      const status = typeof err.status === 'number' ? err.status : 500
      res.status(status).json({
        error: {
          code: err.code ?? 'INTERNAL',
          message: env.NODE_ENV === 'production'
            ? 'An internal error occurred.'
            : (err.message ?? 'Internal error'),
        },
      })
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

    // T56: hard cap on Socket.io message size (128KB — sprites/thoughts are tiny)
    maxHttpBufferSize: 128 * 1024,
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

  // T52: Agent Registry — all agents in one call, wired after world is ready
  const agentRegistry = new AgentRegistry(publicEvents, world)
  registerAgentEventRoutes(app, publicEvents, undefined, agentRegistry)

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
