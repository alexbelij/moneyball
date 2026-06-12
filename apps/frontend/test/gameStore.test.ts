/**
 * gameStore.test.ts | v1.0.0 | 2026-06-12
 * Tests for gameStore: state transitions, selectors, applyWorldState, selectAgent.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

Object.defineProperty(window, 'WebGLRenderingContext', { value: class {}, writable: true, configurable: true })
window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any

import { useGameStore } from '@/store/gameStore'
import type { WorldAgentState, WorldStatePayload } from '@moneyball/shared/events'

const mockAgent = (id: string, name: string): WorldAgentState => ({
  agentId: id,
  name,
  role: 'Tester',
  status: 'idle',
  position: { x: 0, y: 0 },
})

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.setState({
      agents: {},
      ui: { selectedAgentId: null, isConnected: false, isWalletFlowActive: false },
    })
  })

  it('starts disconnected with no agents', () => {
    const s = useGameStore.getState()
    expect(s.ui.isConnected).toBe(false)
    expect(Object.keys(s.agents)).toHaveLength(0)
    expect(s.ui.selectedAgentId).toBeNull()
  })

  it('setConnected updates ui.isConnected', () => {
    useGameStore.getState().setConnected(true)
    expect(useGameStore.getState().ui.isConnected).toBe(true)

    useGameStore.getState().setConnected(false)
    expect(useGameStore.getState().ui.isConnected).toBe(false)
  })

  it('setWalletFlowActive updates ui.isWalletFlowActive', () => {
    useGameStore.getState().setWalletFlowActive(true)
    expect(useGameStore.getState().ui.isWalletFlowActive).toBe(true)
  })

  it('applyWorldState replaces agents record', () => {
    const payload: WorldStatePayload = {
      agents: [
        mockAgent('dr_morgan', 'Dr. Morgan'),
        mockAgent('scout_alvarez', 'Scout Alvarez'),
      ],
    }

    useGameStore.getState().applyWorldState(payload)

    const agents = useGameStore.getState().agents
    expect(Object.keys(agents)).toHaveLength(2)
    expect(agents['dr_morgan'].name).toBe('Dr. Morgan')
    expect(agents['scout_alvarez'].name).toBe('Scout Alvarez')
  })

  it('applyWorldState clears old agents', () => {
    useGameStore.getState().applyWorldState({
      agents: [mockAgent('old', 'Old Agent')],
    })
    expect(useGameStore.getState().agents['old']).toBeDefined()

    useGameStore.getState().applyWorldState({
      agents: [mockAgent('new', 'New Agent')],
    })
    expect(useGameStore.getState().agents['old']).toBeUndefined()
    expect(useGameStore.getState().agents['new']).toBeDefined()
  })

  it('selectAgent sets and clears selection', () => {
    useGameStore.getState().selectAgent('dr_morgan')
    expect(useGameStore.getState().ui.selectedAgentId).toBe('dr_morgan')

    useGameStore.getState().selectAgent(null)
    expect(useGameStore.getState().ui.selectedAgentId).toBeNull()
  })
})
