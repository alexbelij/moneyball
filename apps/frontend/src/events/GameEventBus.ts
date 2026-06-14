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
  /** T48: pause Phaser scene (e.g. while modal is open). */
  'scene:pause': undefined
  /** T48: resume Phaser scene after modal closes. */
  'scene:resume': undefined
}

export const GameEventBus = mitt<GameEvents>()
