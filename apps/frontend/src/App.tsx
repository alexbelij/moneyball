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
import { PixelButton } from '@/components/ui'
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
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 60,
        }}>
          <PixelButton size="small" onClick={() => setStatsOpen((v) => !v)} aria-pressed={statsOpen}>
            Leaderboard
          </PixelButton>
        </div>
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
