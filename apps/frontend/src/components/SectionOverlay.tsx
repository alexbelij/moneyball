/**
 * SectionOverlay | v1.0.0 | 2026-06-17
 * Purpose: Renders the active cabinet section as an overlay panel (T51).
 *          Reuses PixelModal (focus-trap, Escape, restore-focus) for content
 *          sections and the existing StatsBoard for the leaderboard.
 *          Pauses the Phaser scene while a panel is open (GameEventBus),
 *          mirroring the T48 AgentModal behaviour.
 */

import React, { useEffect } from 'react'
import { PixelModal } from '@/components/ui'
import { StatsBoard } from '@/components/StatsBoard'
import { SectionContent } from '@/components/SectionContent'
import { useNavStore } from '@/store/navStore'
import { getSection } from '@/lib/navSections'
import { GameEventBus } from '@/events/GameEventBus'

export function SectionOverlay() {
  const active = useNavStore((s) => s.active)
  const close = useNavStore((s) => s.close)

  // Pause the scene while any section is open; resume on close.
  useEffect(() => {
    if (!active) return
    GameEventBus.emit('scene:pause', undefined)
    return () => {
      GameEventBus.emit('scene:resume', undefined)
    }
  }, [active])

  if (!active) return null

  // Leaderboard reuses the existing StatsBoard panel verbatim.
  if (active === 'leaderboard') {
    return <StatsBoard onClose={close} />
  }

  const section = getSection(active)
  if (!section) return null

  return (
    <PixelModal open onClose={close} title={section.title}>
      <div style={{ padding: 16, maxHeight: '60vh', overflowY: 'auto' }}>
        <SectionContent id={active} />
      </div>
    </PixelModal>
  )
}
