import mitt from 'mitt'

export type GameEvents = {
  'agent:click': { agentId: string }
  'thought:show': { agentId: string; text: string; duration?: number }
  /** Interactive prop clicked in the cabinet scene (props.json id). */
  'prop:click': { propId: string }
  /** Match feed status: true while at least one WC2026 match is live. */
  'matches:live': { live: boolean }
  /** Phaser scene has finished building (world layer + assets loaded). */
  'scene:ready': undefined
}

export const GameEventBus = mitt<GameEvents>()
