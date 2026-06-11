import { describe, expect, it } from 'vitest'
import { InMemoryWorldStateStore } from './worldStateStore'

describe('InMemoryWorldStateStore', () => {
  it('tracks clients and ticks', () => {
    const s = new InMemoryWorldStateStore('main')
    s.joinClient('a')
    s.joinClient('b')
    expect(s.getState().connectedClients).toBe(2)
    const t1 = s.tick()
    const t2 = s.tick()
    expect(t2).toBe(t1 + 1)
    s.leaveClient('a')
    expect(s.getState().connectedClients).toBe(1)
  })
})
