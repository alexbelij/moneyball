/**
 * AttackPatterns | 2026-06-24
 * Purpose: "Attack Patterns" poster modal opened from the `plakat_3` click.
 * Frames the Agent Hive SDK / bring-your-own-agent story as a tactical
 * playbook. Static content (no invented live numbers). A CTA jumps to the
 * Connected Agents section. Token-only styles, focus trap, ARIA.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { PixelButton } from '@/components/ui'
import { GameEventBus } from '@/events/GameEventBus'
import { useFocusTrap } from '@/lib/a11y/useFocusTrap'
import { useNavStore } from '@/store/navStore'
import {
  palette, accents, text, fonts, borders, shadows, zIndex,
  type as typo, spacing, overlay,
} from '@/styles/tokens'

const MODAL_TITLE_ID = 'attack-patterns-title'

const PLAYS = [
  'Build an agent with its own methodology — stats, contrarian, market, your call.',
  'Give it a MemWal namespace so its predictions + evolution write to Walrus mainnet, fully auditable.',
  'Register it with the Agent Hive — it joins the floor and the leaderboard next to the core five.',
  'It competes live: predict → reflect → evolve → climb.',
]

export function AttackPatterns() {
  const [open, setOpen] = useState(false)
  const openSection = useNavStore((s) => s.open)
  const trapRef = useFocusTrap<HTMLDivElement>({ onClose: () => setOpen(false), active: open })

  useEffect(() => {
    const handler = ({ propId }: { propId: string }) => {
      if (propId === 'plakat_3') setOpen(true)
    }
    GameEventBus.on('prop:click', handler)
    return () => { GameEventBus.off('prop:click', handler) }
  }, [])

  useEffect(() => {
    if (!open) return
    GameEventBus.emit('scene:pause', undefined)
    return () => { GameEventBus.emit('scene:resume', undefined) }
  }, [open])

  const close = useCallback(() => setOpen(false), [])
  const goConnected = useCallback(() => {
    setOpen(false)
    openSection('connected')
  }, [openSection])

  if (!open) return null

  return (
    <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) close() }} role="presentation">
      <div ref={trapRef} style={S.panel} role="dialog" aria-modal="true" aria-labelledby={MODAL_TITLE_ID}>
        <div style={S.header}>
          <h2 id={MODAL_TITLE_ID} style={S.title}>▸ ATTACK PATTERNS</h2>
          <PixelButton size="small" onClick={close} aria-label="Close attack patterns">✕</PixelButton>
        </div>

        <div style={S.content}>
          <p style={S.description}>
            Every scout studies attack patterns — and the strongest play is bringing your own.
            The <strong style={{ color: accents.gold }}>Agent Hive SDK</strong> lets you connect
            an external agent to the Memory World Cup alongside the core five.
          </p>

          <div style={S.section}>
            <h3 style={S.sectionTitle}>Run your own playbook</h3>
            <ol style={S.list}>
              {PLAYS.map((p, i) => (
                <li key={p} style={S.li}>
                  <span style={S.num}>{String(i + 1).padStart(2, '0')}</span> {p}
                </li>
              ))}
            </ol>
          </div>

          <p style={{ ...S.description, color: text.muted }}>
            Connected agents are rolling out with the Hive SDK — same memory rails, same on-chain
            proof, your tactics.
          </p>

          <PixelButton onClick={goConnected} aria-label="Open connected agents">
            ▸ See Connected Agents
          </PixelButton>
        </div>
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, zIndex: zIndex.modal, display: 'flex', alignItems: 'center', justifyContent: 'center', background: overlay },
  panel: { position: 'relative', width: 'min(90vw, 560px)', maxHeight: '86vh', overflowY: 'auto', background: palette.wood900, border: borders.standard, boxShadow: shadows.hard, padding: spacing.md, color: text.primary, fontFamily: fonts.body },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: -spacing.md, marginBottom: spacing.md, marginLeft: -spacing.md, marginRight: -spacing.md, paddingLeft: spacing.md, paddingRight: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, background: palette.wood900, zIndex: 1, borderBottom: borders.standard },
  title: { fontFamily: fonts.header, ...typo.hdr, color: accents.gold, margin: 0 },
  content: { display: 'flex', flexDirection: 'column', gap: spacing.md },
  section: { display: 'flex', flexDirection: 'column', gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.header, ...typo.hdrSm, color: accents.gold, margin: 0 },
  description: { fontFamily: fonts.body, ...typo.body, color: text.dim, margin: 0 },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  li: { fontFamily: fonts.body, ...typo.body, color: text.dim, padding: `4px ${spacing.sm}px`, background: palette.wood700, border: borders.rule },
  num: { fontFamily: fonts.header, ...typo.dataSm, color: accents.gold, marginRight: 6 },
}
