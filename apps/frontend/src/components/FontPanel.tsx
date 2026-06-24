/**
 * FontPanel.tsx | 2026-06-24
 * Purpose: Floating "TEXT" panel to switch the UI body font + size. Lets the
 * player pick a more readable typeface (VT323 / Silkscreen / IBM Plex Mono)
 * and bump the size. Persisted via uiPrefs (localStorage). Applies instantly
 * to all HTML text (CSS vars) and to the Phaser canvas labels/bubbles.
 * Token-only styles, keyboard operable, WAI-ARIA.
 */

import React, { useCallback, useState } from 'react'
import { useUiPrefs } from '@/store/uiPrefs'
import {
  FONT_LABELS,
  FONT_SCALES,
  FONT_STACKS,
  SCALE_LABELS,
  type FontChoice,
} from '@/styles/uiFont'
import { palette, accents, text, fonts, borders, zIndex, type as typo } from '@/styles/tokens'

const CHOICES: FontChoice[] = ['vt323', 'silkscreen', 'plex']

export function FontPanel() {
  const [open, setOpen] = useState(false)
  const fontChoice = useUiPrefs((s) => s.fontChoice)
  const setFontChoice = useUiPrefs((s) => s.setFontChoice)
  const fontScale = useUiPrefs((s) => s.fontScale)
  const setFontScale = useUiPrefs((s) => s.setFontScale)

  const toggle = useCallback(() => setOpen((o) => !o), [])

  return (
    <div style={S.root}>
      {open && (
        <div role="dialog" aria-label="Text settings" style={S.panel}>
          <div style={S.heading}>FONT</div>
          <div style={S.group}>
            {CHOICES.map((c) => {
              const active = c === fontChoice
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFontChoice(c)}
                  aria-pressed={active}
                  style={{
                    ...S.optBtn,
                    fontFamily: FONT_STACKS[c],
                    borderColor: active ? accents.gold : palette.wood700,
                    color: active ? accents.gold : text.primary,
                    background: active ? palette.wood700 : palette.wood900,
                  }}
                >
                  {FONT_LABELS[c]}
                </button>
              )
            })}
          </div>

          <div style={S.heading}>SIZE</div>
          <div style={S.group}>
            {FONT_SCALES.map((sc) => {
              const active = sc === fontScale
              return (
                <button
                  key={sc}
                  type="button"
                  onClick={() => setFontScale(sc)}
                  aria-pressed={active}
                  aria-label={`Text size ${SCALE_LABELS[String(sc)]}`}
                  style={{
                    ...S.sizeBtn,
                    borderColor: active ? accents.gold : palette.wood700,
                    color: active ? accents.gold : text.primary,
                    background: active ? palette.wood700 : palette.wood900,
                  }}
                >
                  {SCALE_LABELS[String(sc)]}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label="Text settings (font and size)"
        title="Text settings"
        style={{
          ...S.fab,
          borderColor: open ? accents.gold : palette.wood700,
          color: open ? accents.gold : text.primary,
        }}
      >
        Aa
      </button>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  root: {
    position: 'fixed',
    bottom: 16,
    right: 16,
    zIndex: zIndex.topmost,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
    imageRendering: 'pixelated',
  },
  fab: {
    width: 40,
    height: 40,
    background: palette.wood900,
    border: borders.standard,
    borderRadius: 0,
    cursor: 'pointer',
    fontFamily: fonts.header,
    ...typo.hdrSm,
    lineHeight: '1',
    boxShadow: '0 2px 0 rgba(0,0,0,0.4)',
  },
  panel: {
    width: 188,
    background: palette.wood900,
    border: borders.standard,
    boxShadow: '0 4px 0 rgba(0,0,0,0.4)',
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  heading: {
    fontFamily: fonts.header,
    ...typo.hdrSm,
    color: text.muted,
    letterSpacing: 1,
  },
  group: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  optBtn: {
    flex: '1 1 100%',
    padding: '8px 10px',
    border: `2px solid ${palette.wood700}`,
    borderRadius: 0,
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: 14,
    lineHeight: '16px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  sizeBtn: {
    flex: 1,
    padding: '6px 0',
    border: `2px solid ${palette.wood700}`,
    borderRadius: 0,
    cursor: 'pointer',
    fontFamily: fonts.header,
    ...typo.hdrSm,
  },
}
