/**
 * backend entrypoint | v0.4.0 | 2026-06-09
 * Purpose: Express + Socket.io shared world + MemWal persistence + Sui auth + JWT.
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
  registerAgentEventRoutes(app)
  registerAdminRoutes(app)

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

  const thoughts = [
    'Scanning markets… recalibrating confidence.',
    'Everyone agrees on the favorite. That’s my cue to doubt.',
    'My gut says the captain is hiding fear.',
    'Line moved without news. Someone knows something.',
    'Numbers vibrate oddly today. Watch for chaos.',
  ]

  setInterval(() => {
    const agents = world.getState().agents
    const pick = agents[Math.floor(Math.random() * agents.length)]
    const text = thoughts[Math.floor(Math.random() * thoughts.length)]
    socketApi.broadcastThought(pick.agentId, text)
  }, 1000)

  server.listen(env.PORT, () => {
    console.log(`[backend] listening on http://localhost:${env.PORT}`)
    console.log(`[backend] CORS_ORIGINS: ${env.CORS_ORIGINS.join(',') || '(allow all - dev)'}`)
  })
}

void main()
