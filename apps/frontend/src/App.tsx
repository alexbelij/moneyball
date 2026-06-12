/**
 * App | v0.7.0 | 2026-06-12
 * Conditional mount: lite mode shows LiteDashboard, full mode lazy-loads PhaserGame.
 * Overlay components (HUD, AgentModal, etc.) work in both modes.
 */

import React, { lazy, Suspense, useState } from 'react'
import { useSocket } from '@/hooks/useSocket'
import { useUiPrefs } from '@/store/uiPrefs'
import { HUD } from '@/components/HUD'
import { AgentModal } from '@/components/AgentModal'
import { WalletFlowOverlay } from '@/components/WalletFlowOverlay'
import { config } from '@/lib/config'
import { WalletDebugPanel } from '@/components/WalletDebugPanel'
import { AuthSync } from '@/components/AuthSync'
import { StatsBoard } from '@/components/StatsBoard'
import { MatchTV } from '@/components/MatchTV'
import { LiteDashboard } from '@/components/LiteDashboard'
import { LiteModeToggle } from '@/components/LiteModeToggle'

// Lazy-load Phaser so it's never imported in lite mode
const PhaserGame = lazy(() =>
  import('@/phaser/PhaserGame').then((m) => ({ default: m.PhaserGame })),
)

export default function App() {
  useSocket()
  const liteMode = useUiPrefs((s) => s.liteMode)
  const [statsOpen, setStatsOpen] = useState(false)

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {liteMode ? (
        <LiteDashboard />
      ) : (
        <Suspense
          fallback={
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0f172a',
                color: '#94a3b8',
                fontFamily: 'monospace',
              }}
            >
              Loading arcade…
            </div>
          }
        >
          <PhaserGame />
        </Suspense>
      )}
      <HUD />
      {!liteMode && (
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
      )}
      {statsOpen && !liteMode && <StatsBoard onClose={() => setStatsOpen(false)} />}
      {!liteMode && <MatchTV />}
      <AgentModal />
      <WalletFlowOverlay />
      <AuthSync />
      <LiteModeToggle />
      {config.debugWallet ? <WalletDebugPanel /> : null}
    </div>
  )
}
