export type WorldId = 'main'
export type AgentId = string
export type IsoDateTime = string

export type AgentStatus = 'idle' | 'thinking' | 'acting' | 'busy'

export interface Vec2 {
  x: number
  y: number
}

export interface WorldJoinPayload {
  worldId?: WorldId // default "main"
  token?: string // JWT (optional for MVP)
  clientMeta?: { version?: string; platform?: string }
}

export interface WorldJoinAck {
  ok: boolean
  worldId: WorldId
  serverTime: IsoDateTime
  viewer?: { suiAddress?: string; role?: 'user' | 'admin' | 'guest' }
}

export interface WorldAgentState {
  agentId: AgentId
  name: string
  role: string
  status: AgentStatus
  position: Vec2
  lastThought?: string
  lastActionAt?: IsoDateTime
}

export interface WorldStatePayload {
  worldId: WorldId
  tick: number
  serverTime: IsoDateTime
  connectedClients: number
  agents: WorldAgentState[]
}

export interface AgentThoughtPayload {
  worldId: WorldId
  tick: number
  serverTime: IsoDateTime
  agentId: AgentId
  text: string
  ttlMs: number
}

export interface ErrorPayload {
  code: string
  message: string
  details?: unknown
}
