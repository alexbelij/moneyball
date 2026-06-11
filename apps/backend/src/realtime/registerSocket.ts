/**
 * registerSocket | v0.3.0 | 2026-06-09
 * Purpose: Socket.io shared world join with optional JWT decoding (prod-style).
 * Security: strict algorithm allowlist to prevent alg confusion.
 */

import { C2S, S2C } from '@moneyball/shared/events'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  WorldJoinPayload,
} from '@moneyball/shared/events'
import type { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { SimpleRateLimiter } from '../util/rateLimit'
import type { WorldStateStore } from './worldStateStore'

type JwtPayload = {
  sub: string
  role: 'user' | 'admin'
  iat?: number
  exp?: number
}

export function registerSocket(
  io: Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
  world: WorldStateStore,
) {
  const thoughtRl = new SimpleRateLimiter(1500)

  io.on('connection', (socket) => {
    socket.on(C2S.WORLD_JOIN, (payload: WorldJoinPayload, ack) => {
      const worldId = payload.worldId ?? 'main'
      socket.data.worldId = worldId

      socket.data.role = 'guest'
      delete socket.data.suiAddress

      if (payload.token && typeof payload.token === 'string') {
        try {
          const p = jwt.verify(payload.token, env.JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload
          socket.data.suiAddress = String(p.sub).toLowerCase()
          socket.data.role = p.role
        } catch {
          // ignore invalid token
        }
      }

      socket.join(`world:${worldId}`)
      world.joinClient(socket.id)

      ack?.({
        ok: true,
        worldId,
        serverTime: new Date().toISOString(),
        viewer: socket.data.suiAddress
          ? { suiAddress: socket.data.suiAddress, role: socket.data.role as any }
          : { role: 'guest' },
      })

      socket.emit(S2C.WORLD_STATE, world.getState())
    })

    socket.on('disconnect', () => world.leaveClient(socket.id))
  })

  return {
    broadcastThought(agentId: string, text: string) {
      if (!thoughtRl.allow(agentId)) return false
      const tick = world.tick()
      io.to('world:main').emit(S2C.AGENT_THOUGHT, {
        worldId: 'main',
        tick,
        serverTime: new Date().toISOString(),
        agentId,
        text,
        ttlMs: 2500,
      })
      return true
    },
  }
}
