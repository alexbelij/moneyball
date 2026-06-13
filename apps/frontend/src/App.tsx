/**
 * App | v0.8.0 | 2026-06-13
 * Conditional mount: lite mode shows LiteDashboard, full mode lazy-loads PhaserGame.
 * T13: pixel-art loading skeleton shown until Phaser scene:ready fires.
 * T18: OfflineBanner for connection status.
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
import { OfflineBanner } from '@/components/OfflineBanner'
import { LoadingSkeleton, useSceneReady } from '@/components/LoadingSkeleton'

// Lazy-load Phaser so it's never imported in lite mode
const PhaserGame = lazy(() =>
  import('@/phaser/PhaserGame').then((m) => ({ default: m.PhaserGame })),
)

export default function App() {
  useSocket()
  const liteMode = useUiPrefs((s) => s.liteMode)
  const sceneReady = useSceneReady()
  const [statsOpen, setStatsOpen] = useState(false)

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {liteMode ? (
        <LiteDashboard />
      ) : (
        <>
          <Suspense fallback={<LoadingSkeleton />}>
            <PhaserGame />
          </Suspense>
          {/* Show skeleton over Phaser until scene:ready */}
          {!sceneReady && <LoadingSkeleton />}
        </>
      )}
      <HUD />
      {!liteMode && (
        <button
          onClick={() => setStatsOpen((v) => !v)}
          style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 60,
            padding: '4px 10px',
            fontFamily: '"VT323", monospace', fontSize: 16,
            color: '#f4ede2', background: '#181009',
            border: '2px solid #3a3020', borderRadius: 0,
            cursor: 'pointer',
            boxShadow: '2px 2px 0 #000',
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
      <OfflineBanner />
      {config.debugWallet ? <WalletDebugPanel /> : null}
    </div>
  )
}
