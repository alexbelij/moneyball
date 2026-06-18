/**
 * App | v0.9.0 | 2026-06-18
 * Conditional mount: lite mode shows LiteDashboard, full mode lazy-loads PhaserGame.
 * T51: replaced standalone Leaderboard button with NavMenu + SectionOverlay.
 * T59: OnboardingOverlay for first-run guided walkthrough.
 * T13: pixel-art loading skeleton shown until Phaser scene:ready fires.
 * T18: OfflineBanner for connection status.
 * T68: ErrorBoundary around Phaser canvas and AgentModal — heavy widgets
 *      that may crash independently without taking down the whole app.
* T75: MemoryLab, WalrusProof, AboutDoor modals for board_left/board_scout/door props.
 * Overlay components (HUD, AgentModal, etc.) work in both modes.
 */

import React, { lazy, Suspense, useState } from 'react'
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

import { StatsBoard } from '@/components/StatsBoard'
import { TacticsBoard } from '@/components/TacticsBoard'
import { MemoryLab } from '@/components/MemoryLab'
import { WalrusProof } from '@/components/WalrusProof'
import { AboutDoor } from '@/components/AboutDoor'
import { MatchTV } from '@/components/MatchTV'
import { LiteDashboard } from '@/components/LiteDashboard'
import { LiteModeToggle } from '@/components/LiteModeToggle'
import { OfflineBanner } from '@/components/OfflineBanner'

import { ConnectedAgents } from '@/components/ConnectedAgents'
import { PortraitGuard } from '@/components/PortraitGuard'
import { PixelButton } from '@/components/ui'
import { LoadingSkeleton, useSceneReady } from '@/components/LoadingSkeleton'
import { ErrorBoundary } from '@/components/error/ErrorBoundary'

// Lazy-load Phaser so it's never imported in lite mode
const PhaserGame = lazy(() =>
  import('@/phaser/PhaserGame').then((m) => ({ default: m.PhaserGame })),
)

export default function App() {
  useSocket()
  useHashRoute()
  const liteMode = useUiPrefs((s) => s.liteMode)
  const sceneReady = useSceneReady()

const [statsOpen, setStatsOpen] = useState(false)
  const [hiveOpen, setHiveOpen] = useState(false)

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {liteMode ? (
        <LiteDashboard />
      ) : (
        <ErrorBoundary label="Game View" minHeight="100vh">
          <Suspense fallback={<LoadingSkeleton />}>
            <PhaserGame />
          </Suspense>
          {/* Show skeleton over Phaser until scene:ready */}
          {!sceneReady && <LoadingSkeleton />}
        </ErrorBoundary>
      )}
      <HUD />
      {!liteMode && <NavMenu />}
      <SectionOverlay />
      {!liteMode && <MatchTV />}
      <ErrorBoundary label="Agent Dossier" minHeight="300px">
        <AgentModal />
      </ErrorBoundary>
{!liteMode && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 60,
          display: 'flex', gap: 8,
        }}>
          <PixelButton size="small" onClick={() => setStatsOpen((v: boolean) => !v)} aria-pressed={statsOpen}>
            Leaderboard
          </PixelButton>
          <PixelButton size="small" onClick={() => setHiveOpen((v: boolean) => !v)} aria-pressed={hiveOpen}>
            Hive
          </PixelButton>
        </div>
      )}
      {statsOpen && !liteMode && <StatsBoard onClose={() => setStatsOpen(false)} />}
      {hiveOpen && <ConnectedAgents onClose={() => setHiveOpen(false)} />}
{!liteMode && <TacticsBoard />}
{!liteMode && <MemoryLab />}
      {!liteMode && <WalrusProof />}
      {!liteMode && <AboutDoor />}
      {!liteMode && <MatchTV />}
      <AgentModal />
      <WalletFlowOverlay />
      <AuthSync />
      <LiteModeToggle />
      <OfflineBanner />
      <OnboardingOverlay />
      {config.debugWallet ? <WalletDebugPanel /> : null}
      <PortraitGuard />
    </div>
  )
}
