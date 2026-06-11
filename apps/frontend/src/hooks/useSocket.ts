import { useEffect } from 'react'
import { io } from 'socket.io-client'
import { C2S, S2C, type AgentThoughtPayload, type WorldJoinAck, type WorldStatePayload } from '@moneyball/shared/events'
import { useGameStore } from '@/store/gameStore'
import { GameEventBus } from '@/events/GameEventBus'
import { config } from '@/lib/config'
import { useAuthStore } from '@/store/authStore'

export function useSocket() {
  useEffect(() => {
    const socket = io(config.backendUrl, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      autoConnect: true,
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
