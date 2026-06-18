/**
 * App | v0.9.0 | 2026-06-17
 * Conditional mount: lite mode shows LiteDashboard, full mode lazy-loads PhaserGame.
 * T51: replaced standalone Leaderboard button with NavMenu + SectionOverlay.
 * T13: pixel-art loading skeleton shown until Phaser scene:ready fires.
 * T18: OfflineBanner for connection status.
 * Overlay components (HUD, AgentModal, etc.) work in both modes.
 */

import React, { lazy, Suspense } from 'react'
import { useSocket } from '@/hooks/useSocket'
import { useUiPrefs } from '@/store/uiPrefs'
import { useHashRoute } from '@/hooks/useHashRoute'
import { HUD } from '@/components/HUD'
import { AgentModal } from '@/components/AgentModal'
import { NavMenu } from '@/components/NavMenu'
import { SectionOverlay } from '@/components/SectionOverlay'
import { WalletFlowOverlay } from '@/components/WalletFlowOverlay'
import { config } from '@/lib/config'
import { WalletDebugPanel } from '@/components/WalletDebugPanel'
import { AuthSync } from '@/components/AuthSync'
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
  useHashRoute()
  const liteMode = useUiPrefs((s) => s.liteMode)
  const sceneReady = useSceneReady()

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
      {!liteMode && <NavMenu />}
      <SectionOverlay />
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
