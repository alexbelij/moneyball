/**
 * PhaserGame | v0.4.0 | 2026-06-13
 * Purpose: Create Phaser instance once and sleep/wake the main loop during wallet flow.
 * T13: pixel-art config (pixelArt: true, roundPixels: true, bg #000000 letterbox).
 */

import React, { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { CabinetScene } from '@/phaser/scenes/CabinetScene'
import { useGameStore } from '@/store/gameStore'

export function PhaserGame() {
  const ref = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const sleepingRef = useRef(false)

  useEffect(() => {
    if (!ref.current || gameRef.current) return

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: ref.current,
      width: '100%',
      height: '100%',
      backgroundColor: '#000000',
      pixelArt: true,
      roundPixels: true,
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [CabinetScene],
    })

    // Subscribe to wallet flow flag and sleep/wake loop
    const unsub = useGameStore.subscribe(
      (s) => s.ui.isWalletFlowActive,
      (active) => {
        const game = gameRef.current
        if (!game) return

        if (active && !sleepingRef.current) {
          sleepingRef.current = true
          game.loop.sleep()
        }

        if (!active && sleepingRef.current) {
          sleepingRef.current = false
          game.loop.wake()
        }
      },
    )

    return () => {
      unsub()
      gameRef.current?.destroy(true)
      gameRef.current = null
      sleepingRef.current = false
    }
  }, [])

  return <div ref={ref} style={{ position: 'absolute', inset: 0 }} />
}
