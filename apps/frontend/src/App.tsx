/**
 * App | v0.5.0 | 2026-06-09
 */

import React from 'react'
import { useSocket } from '@/hooks/useSocket'
import { PhaserGame } from '@/phaser/PhaserGame'
import { HUD } from '@/components/HUD'
import { AgentModal } from '@/components/AgentModal'
import { WalletFlowOverlay } from '@/components/WalletFlowOverlay'
import { config } from '@/lib/config'
import { WalletDebugPanel } from '@/components/WalletDebugPanel'
import { AuthSync } from '@/components/AuthSync'

export default function App() {
  useSocket()
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <PhaserGame />
      <HUD />
      <AgentModal />
      <WalletFlowOverlay />
      <AuthSync />
      {config.debugWallet ? <WalletDebugPanel /> : null}
    </div>
  )
}
