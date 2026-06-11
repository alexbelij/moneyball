export const C2S = {
    WORLD_JOIN: 'world:join',
} as const

export const S2C = {
    WORLD_STATE: 'world:state',
    AGENT_THOUGHT: 'agent:thought',
    ERROR: 'error',
} as const

export type C2SEvent = (typeof C2S)[keyof typeof C2S]
export type S2CEvent = (typeof S2C)[keyof typeof S2C]