/**
 * RankMedal | v1.0.0 | 2026-06-13
 * Purpose: Pixel rank badge for leaderboards (T34). Top-3 get a hard-bevelled
 * medal chip (gold / silver-wood / bronze); everyone else gets a plain rank
 * number. NO emoji — design-spec compliant pixel glyph/text.
 */

import React from 'react'
import { palette, accents, text, fonts, shadows, type as typo } from '@/styles/tokens'

const MEDAL_BG: Record<number, string> = {
  1: accents.gold,
  2: palette.wood200,
  3: palette.wood500,
}

export function RankMedal({ rank }: { rank: number }) {
  const isMedal = rank >= 1 && rank <= 3
  const bg = isMedal ? MEDAL_BG[rank] : 'transparent'
  const fg = isMedal ? palette.wood900 : text.muted
  return (
    <span
      aria-label={`Rank ${rank}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 24,
        height: 22,
        padding: '0 4px',
        fontFamily: fonts.header,
        ...typo.svgAxis,
        lineHeight: 1,
        color: fg,
        background: bg,
        border: isMedal ? `2px solid ${palette.wood900}` : 'none',
        boxShadow: isMedal ? shadows.hardSmall : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {rank}
    </span>
  )
}
