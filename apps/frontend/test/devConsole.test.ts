/**
 * devConsole.test.ts | v1.0.0 | 2026-06-14
 * Tests for T50 developer-console easter egg.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { initDevConsole, liveAgentRows, __resetDevConsoleForTest } from '@/lib/devConsole'
import { useGameStore } from '@/store/gameStore'

beforeEach(() => {
  __resetDevConsoleForTest()
  // reset world state between tests
  useGameStore.setState({ agents: {} } as any)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('initDevConsole', () => {
  it('prints once and is idempotent', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    expect(initDevConsole()).toBe(true)
    expect(log).toHaveBeenCalled()
    const callsAfterFirst = log.mock.calls.length
    // second call should be a no-op
    expect(initDevConsole()).toBe(false)
    expect(log.mock.calls.length).toBe(callsAfterFirst)
  })

  it('uses %c styled banner and mentions the agent SDK', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    initDevConsole()
    const joined = log.mock.calls.map((c) => String(c[0])).join('\n')
    expect(joined).toContain('%c')
    expect(joined.toLowerCase()).toContain('agent')
  })
})

describe('liveAgentRows', () => {
  it('is empty when no agents are present', () => {
    expect(liveAgentRows()).toEqual([])
  })

  it('maps world agents into table rows', () => {
    useGameStore.setState({
      agents: {
        dr_morgan: {
          agentId: 'dr_morgan',
          name: 'Dr. Morgan',
          role: 'Analyst',
          status: 'thinking',
          position: { x: 0, y: 0 },
          lastThought: 'xG says draw',
        },
      },
    } as any)
    const rows = liveAgentRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      agentId: 'dr_morgan',
      name: 'Dr. Morgan',
      role: 'Analyst',
      status: 'thinking',
      lastThought: 'xG says draw',
    })
  })

  it('falls back to a dash when lastThought is missing', () => {
    useGameStore.setState({
      agents: {
        x: { agentId: 'x', name: 'X', role: 'R', status: 'idle', position: { x: 0, y: 0 } },
      },
    } as any)
    expect(liveAgentRows()[0].lastThought).toBe('—')
  })
})
