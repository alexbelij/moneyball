/**
 * useSocket | v0.2.0 | 2026-06-13
 * Purpose: Socket.io client with explicit exponential backoff + REST hydration.
 * T18: reconnect config, backoff 1s→30s, REST hydration on connect,
 * connection state drives offline banner via gameStore.isConnected.
 */

import { useEffect } from 'react'
import { io } from 'socket.io-client'
import { C2S, S2C, type AgentThoughtPayload, type WorldJoinAck, type WorldStatePayload } from '@moneyball/shared/events'
import { useGameStore } from '@/store/gameStore'
import { GameEventBus } from '@/events/GameEventBus'
import { config } from '@/lib/config'
import { useAuthStore } from '@/store/authStore'
import { hydrateFromRest } from '@/lib/hydrate'

export function useSocket() {
  useEffect(() => {
    const socket = io(config.backendUrl, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      autoConnect: true,
      /* Explicit exponential backoff (socket.io multiplies by
         reconnectionDelayMax factor internally; these values give
         ~1s → 2s → 4s … capped at 30s). */
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30_000,
      randomizationFactor: 0.25,
      timeout: 10_000,
    })

    const join = () => {
      const token = useAuthStore.getState().token
      socket.emit(C2S.WORLD_JOIN, { worldId: 'main', ...(token ? { token } : {}) }, (ack: WorldJoinAck) => {
        if (!ack.ok) console.warn('[socket] join not ok', ack)
      })
    }

    socket.on('connect', () => {
      useGameStore.getState().setConnected(true)
      join()
      // REST hydration: fetch latest agent data on (re)connect so the room
      // populates immediately without waiting for the next server tick.
      void hydrateFromRest()
    })

    socket.on('disconnect', () => useGameStore.getState().setConnected(false))

    socket.on(S2C.WORLD_STATE, (payload: WorldStatePayload) => {
      useGameStore.getState().applyWorldState(payload)
    })

    socket.on(S2C.AGENT_THOUGHT, (payload: AgentThoughtPayload) => {
      GameEventBus.emit('thought:show', { agentId: payload.agentId, text: payload.text, duration: payload.ttlMs })
    })

    const unsub = useAuthStore.subscribe(
      (s) => s.token,
      () => {
        if (socket.connected) join()
      },
    )

    return () => { unsub(); socket.disconnect() }
  }, [])
}
