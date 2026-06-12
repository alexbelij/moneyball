/**
 * App | v0.6.0 | 2026-06-12
 */

import React, { useState } from 'react'
import { useSocket } from '@/hooks/useSocket'
import { PhaserGame } from '@/phaser/PhaserGame'
import { HUD } from '@/components/HUD'
import { AgentModal } from '@/components/AgentModal'
import { WalletFlowOverlay } from '@/components/WalletFlowOverlay'
import { config } from '@/lib/config'
import { WalletDebugPanel } from '@/components/WalletDebugPanel'
import { AuthSync } from '@/components/AuthSync'
import { StatsBoard } from '@/components/StatsBoard'
import { MatchTV } from '@/components/MatchTV'

export default function App() {
  useSocket()
  const [statsOpen, setStatsOpen] = useState(false)
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <PhaserGame />
      <HUD />
      <button
        onClick={() => setStatsOpen((v) => !v)}
        style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 60,
          padding: '6px 12px', borderRadius: 8, border: '1px solid #374151',
          background: 'rgba(17,24,39,0.85)', color: '#e5e7eb', fontSize: 12, cursor: 'pointer',
        }}
      >
        🏆 Leaderboard
      </button>
      {statsOpen && <StatsBoard onClose={() => setStatsOpen(false)} />}
      <MatchTV />
      <AgentModal />
      <WalletFlowOverlay />
      <AuthSync />
      {config.debugWallet ? <WalletDebugPanel /> : null}
    </div>
  )
}
