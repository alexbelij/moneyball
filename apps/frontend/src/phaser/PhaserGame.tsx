/**
 * PhaserGame | v0.4.0 | 2026-06-13
 * Purpose: Create Phaser instance once and sleep/wake the main loop during wallet flow.
 * T17: pixelArt + roundPixels for nearest-neighbor scaling; #000 letterbox bg.
 * T13: scene:ready event for loading skeleton.
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

    // Render the canvas backing store at the device pixel ratio (capped at 2)
    // so text on posters and the room art stay crisp on Retina / when zoomed,
    // then display it at the logical CSS size. Fixes the "floating/blurry"
    // look on HiDPI screens.
    const dpr = () => Math.min(window.devicePixelRatio || 1, 2)

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: ref.current,
      width: window.innerWidth * dpr(),
      height: window.innerHeight * dpr(),
      backgroundColor: '#000000',
      pixelArt: true,
      roundPixels: true,
      scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
      scene: [CabinetScene],
    })
    gameRef.current = game

    // Display the high-res canvas at the logical viewport size.
    const styleCanvas = () => {
      const c = game.canvas
      if (!c) return
      c.style.width = '100%'
      c.style.height = '100%'
      c.style.imageRendering = 'pixelated'
    }
    styleCanvas()

    const onResize = () => {
      game.scale.resize(window.innerWidth * dpr(), window.innerHeight * dpr())
      styleCanvas()
    }
    window.addEventListener('resize', onResize)

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
      window.removeEventListener('resize', onResize)
      gameRef.current?.destroy(true)
      gameRef.current = null
      sleepingRef.current = false
    }
  }, [])

  return <div ref={ref} style={{ position: 'absolute', inset: 0 }} />
}
