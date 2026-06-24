/**
 * App | v1.0.0 | 2026-06-19
 * Conditional mount: lite mode shows LiteDashboard, full mode lazy-loads PhaserGame.
 * T51: NavMenu + SectionOverlay.
 * T59: OnboardingOverlay for first-run guided walkthrough.
 * T13: pixel-art loading skeleton shown until Phaser scene:ready fires.
 * T18: OfflineBanner for connection status.
 * T68: ErrorBoundary around Phaser canvas and AgentModal.
 * T75: MemoryLab, WalrusProof, AboutDoor modals.
 * P0: removed duplicate MatchTV/AgentModal, added CRT scanline overlay.
 */

import React, { lazy, Suspense } from 'react'
import { useSocket } from '@/hooks/useSocket'
import { useUiPrefs } from '@/store/uiPrefs'
import { useHashRoute } from '@/hooks/useHashRoute'
import { HUD } from '@/components/HUD'
import { AgentModal } from '@/components/AgentModal'
import { NavMenu } from '@/components/NavMenu'
import { SectionOverlay } from '@/components/SectionOverlay'
import { OnboardingOverlay } from '@/components/OnboardingOverlay'
import { WalletFlowOverlay } from '@/components/WalletFlowOverlay'
import { config } from '@/lib/config'
import { WalletDebugPanel } from '@/components/WalletDebugPanel'
import { AuthSync } from '@/components/AuthSync'

// StatsBoard and ConnectedAgents now opened via NavMenu/SectionOverlay only
import { TacticsBoard } from '@/components/TacticsBoard'
import { MemoryLab } from '@/components/MemoryLab'
import { WalrusProof } from '@/components/WalrusProof'
import { AboutDoor } from '@/components/AboutDoor'
import { DiscardedHypotheses } from '@/components/DiscardedHypotheses'
import { AttackPatterns } from '@/components/AttackPatterns'
import { MatchTV } from '@/components/MatchTV'
import { LiteDashboard } from '@/components/LiteDashboard'
import { LiteModeToggle } from '@/components/LiteModeToggle'
import { FontPanel } from '@/components/FontPanel'
import { OfflineBanner } from '@/components/OfflineBanner'

import { PortraitGuard } from '@/components/PortraitGuard'
import { LoadingSkeleton, useSceneReady } from '@/components/LoadingSkeleton'
import { ErrorBoundary } from '@/components/error/ErrorBoundary'
import { CrtOverlay } from '@/components/CrtOverlay'

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
        <ErrorBoundary label="Game View" minHeight="100vh">
          <Suspense fallback={<LoadingSkeleton />}>
            <PhaserGame />
          </Suspense>
          {!sceneReady && <LoadingSkeleton />}
        </ErrorBoundary>
      )}

      {/* CRT scanline effect over game canvas */}
      {!liteMode && <CrtOverlay />}

      {!liteMode && <HUD />}
      {!liteMode && <NavMenu />}
      <SectionOverlay />

      {/* StatsBoard / ConnectedAgents — opened via NavMenu only */}

      {/* Overlay panels (full mode only) */}
      {!liteMode && <TacticsBoard />}
      {!liteMode && <MemoryLab />}
      {!liteMode && <WalrusProof />}
      {!liteMode && <AboutDoor />}
      {!liteMode && <DiscardedHypotheses />}
      {!liteMode && <AttackPatterns />}
      {!liteMode && <MatchTV />}

      {/* Shared overlays (both modes) */}
      <ErrorBoundary label="Agent Dossier" minHeight="300px">
        <AgentModal />
      </ErrorBoundary>
      <WalletFlowOverlay />
      <AuthSync />
      <LiteModeToggle />
      <FontPanel />
      <OfflineBanner />
      <OnboardingOverlay />
      {config.debugWallet ? <WalletDebugPanel /> : null}
      <PortraitGuard />
    </div>
  )
}
