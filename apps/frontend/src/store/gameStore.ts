/**
 * gameStore | v0.3.0 | 2026-06-09
 * Purpose: UI + world state store shared by React and Phaser (supports subscribe(selector, listener)).
 */

import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { WorldAgentState, WorldStatePayload } from '@moneyball/shared/events'
import { GameEventBus } from '@/events/GameEventBus'

interface UIState {
  selectedAgentId: string | null
  isConnected: boolean
  isWalletFlowActive: boolean
}

interface GameState {
  agents: Record<string, WorldAgentState>
  ui: UIState
  setConnected: (v: boolean) => void
  setWalletFlowActive: (v: boolean) => void
  applyWorldState: (payload: WorldStatePayload) => void
  selectAgent: (id: string | null) => void
}

export const useGameStore = create<GameState>()(
  devtools(
    subscribeWithSelector(
      immer((set) => ({
        agents: {},
        ui: { selectedAgentId: null, isConnected: false, isWalletFlowActive: false },

        setConnected: (v) => set((s) => { s.ui.isConnected = v }),

        setWalletFlowActive: (v) => set((s) => { s.ui.isWalletFlowActive = v }),

        applyWorldState: (payload) => set((s) => {
          s.agents = {}
          for (const a of payload.agents) s.agents[a.agentId] = a
        }),

        selectAgent: (id) => set((s) => { s.ui.selectedAgentId = id }),
      })),
    ),
  ),
)

GameEventBus.on('agent:click', ({ agentId }) => {
  useGameStore.getState().selectAgent(agentId)
})
