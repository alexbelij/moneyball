import type { C2S, S2C } from './names'
import type {
  AgentThoughtPayload,
  ErrorPayload,
  WorldJoinAck,
  WorldJoinPayload,
  WorldStatePayload,
} from './types'

export interface ClientToServerEvents {
  [C2S.WORLD_JOIN]: (payload: WorldJoinPayload, ack?: (resp: WorldJoinAck) => void) => void
}

export interface ServerToClientEvents {
  [S2C.WORLD_STATE]: (payload: WorldStatePayload) => void
  [S2C.AGENT_THOUGHT]: (payload: AgentThoughtPayload) => void
  [S2C.ERROR]: (payload: ErrorPayload) => void
}

export interface InterServerEvents {}

export interface SocketData {
  worldId?: 'main'
  suiAddress?: string
  role?: 'user' | 'admin' | 'guest'
}
