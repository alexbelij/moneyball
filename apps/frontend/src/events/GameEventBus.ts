import mitt from 'mitt'

export type GameEvents = {
  'agent:click': { agentId: string }
  'thought:show': { agentId: string; text: string; duration?: number }
}

export const GameEventBus = mitt<GameEvents>()
