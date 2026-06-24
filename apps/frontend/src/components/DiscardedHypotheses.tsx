/**
 * DiscardedHypotheses | 2026-06-24
 * Purpose: Easter-egg "trash bin" modal opened from the `trash` prop click.
 * Explains how agents prune weak / rejected hypotheses during the
 * reflect→evolve cycle (ties into the Walrus Memory theme). Purely static
 * content — no invented live numbers. Token-only styles, focus trap, ARIA.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { PixelButton } from '@/components/ui'
import { GameEventBus } from '@/events/GameEventBus'
import { useFocusTrap } from '@/lib/a11y/useFocusTrap'
import {
  palette, accents, text, fonts, borders, shadows, zIndex,
  type as typo, spacing, overlay,
} from '@/styles/tokens'

const MODAL_TITLE_ID = 'discarded-title'

const REASONS = [
  'Calls below the agent\u2019s own confidence threshold',
  'Hypotheses contradicted by the actual match result',
  'Reasoning a later evolution step overrides',
  'Stale or duplicate reads from earlier game weeks',
]

export function DiscardedHypotheses() {
  const [open, setOpen] = useState(false)
  const trapRef = useFocusTrap<HTMLDivElement>({ onClose: () => setOpen(false), active: open })

  useEffect(() => {
    const handler = ({ propId }: { propId: string }) => {
      if (propId === 'trash') setOpen(true)
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

  if (!open) return null

  return (
    <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) close() }} role="presentation">
      <div ref={trapRef} style={S.panel} role="dialog" aria-modal="true" aria-labelledby={MODAL_TITLE_ID}>
        <div style={S.header}>
          <h2 id={MODAL_TITLE_ID} style={S.title}>✕ DISCARDED HYPOTHESES</h2>
          <PixelButton size="small" onClick={close} aria-label="Close bin">✕</PixelButton>
        </div>

        <div style={S.content}>
          <p style={S.description}>
            The bin holds the ideas the scouts threw out. During every{' '}
            <strong style={{ color: accents.gold }}>reflect → evolve</strong> cycle, predictions and
            reasoning paths that prove weak get pruned, so they never pollute future memory.
          </p>

          <div style={S.section}>
            <h3 style={S.sectionTitle}>Why an agent discards</h3>
            <ul style={S.list}>
              {REASONS.map((r) => (
                <li key={r} style={S.li}><span style={{ color: accents.gold }}>›</span> {r}</li>
              ))}
            </ul>
          </div>

          <div style={S.section}>
            <h3 style={S.sectionTitle}>Nothing is truly deleted</h3>
            <p style={S.description}>
              Discarded reasoning still stays auditable — every write, including the ones later
              rejected, is recorded on Walrus mainnet. The agent simply stops weighting it. You can
              trace the full chain in <strong style={{ color: accents.gold }}>Walrus Proof</strong>.
            </p>
          </div>

          <div style={S.footer}>“Good scouting is knowing what to ignore.”</div>
        </div>
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, zIndex: zIndex.modal, display: 'flex', alignItems: 'center', justifyContent: 'center', background: overlay },
  panel: { position: 'relative', width: 'min(90vw, 540px)', maxHeight: '86vh', overflowY: 'auto', background: palette.wood900, border: borders.standard, boxShadow: shadows.hard, padding: spacing.md, color: text.primary, fontFamily: fonts.body },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: -spacing.md, marginBottom: spacing.md, marginLeft: -spacing.md, marginRight: -spacing.md, paddingLeft: spacing.md, paddingRight: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, background: palette.wood900, zIndex: 1, borderBottom: borders.standard },
  title: { fontFamily: fonts.header, ...typo.hdr, color: accents.gold, margin: 0 },
  content: { display: 'flex', flexDirection: 'column', gap: spacing.md },
  section: { display: 'flex', flexDirection: 'column', gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.header, ...typo.hdrSm, color: accents.gold, margin: 0 },
  description: { fontFamily: fonts.body, ...typo.body, color: text.dim, margin: 0 },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  li: { fontFamily: fonts.body, ...typo.body, color: text.dim, padding: `4px ${spacing.sm}px`, background: palette.wood700, border: borders.rule },
  footer: { fontFamily: fonts.body, ...typo.caption, color: text.muted, textAlign: 'center', marginTop: spacing.sm },
}
