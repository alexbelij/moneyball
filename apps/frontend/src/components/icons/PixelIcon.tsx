/**
 * PixelIcon | v1.0.0 | 2026-06-19
 * 16-bit pixel-art SVG icon set. All icons are 16×16 grid, hard-edge,
 * no curves — faithful to the arcade cabinet design language.
 *
 * Usage: <PixelIcon name="dr_morgan" size={16} color={accents.gold} />
 */
import React from 'react'

/* ── Inline SVG paths (tree-shakeable, no file-loader needed) ────── */

const ICONS: Record<string, React.ReactNode> = {
  dr_morgan: <><rect x="3" y="1" width="10" height="2"/>
  <rect x="2" y="3" width="2" height="8"/>
  <rect x="12" y="3" width="2" height="8"/>
  <rect x="4" y="5" width="8" height="2"/>
  <rect x="4" y="9" width="8" height="2"/>
  <rect x="3" y="11" width="10" height="2"/>
  <rect x="6" y="13" width="4" height="2"/></>,
  scout_alvarez: <><rect x="6" y="1" width="4" height="2"/>
  <rect x="4" y="3" width="2" height="2"/>
  <rect x="10" y="3" width="2" height="2"/>
  <rect x="2" y="5" width="2" height="6"/>
  <rect x="12" y="5" width="2" height="6"/>
  <rect x="4" y="11" width="2" height="2"/>
  <rect x="10" y="11" width="2" height="2"/>
  <rect x="6" y="13" width="4" height="2"/>
  <rect x="7" y="6" width="2" height="4"/>
  <rect x="5" y="8" width="6" height="2"/></>,
  viktor_kane: <><rect x="2" y="2" width="2" height="2"/>
  <rect x="12" y="2" width="2" height="2"/>
  <rect x="4" y="4" width="2" height="2"/>
  <rect x="10" y="4" width="2" height="2"/>
  <rect x="6" y="6" width="4" height="4"/>
  <rect x="4" y="10" width="2" height="2"/>
  <rect x="10" y="10" width="2" height="2"/>
  <rect x="2" y="12" width="2" height="2"/>
  <rect x="12" y="12" width="2" height="2"/></>,
  sofia_mendes: <><rect x="7" y="1" width="2" height="4"/>
  <rect x="11" y="3" width="2" height="2"/>
  <rect x="13" y="5" width="2" height="2"/>
  <rect x="11" y="7" width="4" height="2"/>
  <rect x="7" y="7" width="2" height="2"/>
  <rect x="1" y="7" width="4" height="2"/>
  <rect x="3" y="9" width="2" height="2"/>
  <rect x="5" y="11" width="2" height="2"/>
  <rect x="7" y="11" width="2" height="4"/></>,
  madame_pythia: <><rect x="6" y="1" width="4" height="2"/>
  <rect x="4" y="3" width="8" height="2"/>
  <rect x="3" y="5" width="10" height="2"/>
  <rect x="4" y="7" width="8" height="2"/>
  <rect x="5" y="9" width="6" height="2"/>
  <rect x="6" y="11" width="4" height="2"/>
  <rect x="7" y="13" width="2" height="2"/></>,
  live_dot: <><rect x="6" y="6" width="4" height="4"/>
  <rect x="4" y="4" width="2" height="2"/>
  <rect x="10" y="4" width="2" height="2"/>
  <rect x="4" y="10" width="2" height="2"/>
  <rect x="10" y="10" width="2" height="2"/></>,
  play: <><rect x="4" y="2" width="2" height="12"/>
  <rect x="6" y="4" width="2" height="8"/>
  <rect x="8" y="6" width="2" height="4"/>
  <rect x="10" y="7" width="2" height="2"/></>,
  link: <><rect x="1" y="1" width="6" height="2"/>
  <rect x="1" y="1" width="2" height="6"/>
  <rect x="5" y="5" width="2" height="2"/>
  <rect x="7" y="7" width="2" height="2"/>
  <rect x="9" y="9" width="6" height="2"/>
  <rect x="13" y="9" width="2" height="6"/>
  <rect x="9" y="13" width="6" height="2"/></>,
  walrus: <><rect x="4" y="1" width="8" height="2"/>
  <rect x="2" y="3" width="12" height="2"/>
  <rect x="2" y="5" width="12" height="4"/>
  <rect x="4" y="9" width="2" height="4"/>
  <rect x="10" y="9" width="2" height="4"/>
  <rect x="3" y="5" width="2" height="2"/>
  <rect x="11" y="5" width="2" height="2"/></>,
  hackathon: <><rect x="6" y="1" width="4" height="2"/>
  <rect x="4" y="3" width="8" height="2"/>
  <rect x="3" y="5" width="10" height="6"/>
  <rect x="5" y="11" width="6" height="2"/>
  <rect x="7" y="13" width="2" height="2"/></>,
  reflect: <><rect x="7" y="1" width="2" height="14"/>
  <rect x="3" y="3" width="4" height="2"/>
  <rect x="9" y="3" width="4" height="2"/>
  <rect x="1" y="5" width="4" height="4"/>
  <rect x="11" y="5" width="4" height="4"/>
  <rect x="3" y="9" width="4" height="2"/>
  <rect x="9" y="9" width="4" height="2"/></>,
  evolve: <><rect x="7" y="1" width="2" height="2"/>
  <rect x="5" y="3" width="6" height="2"/>
  <rect x="3" y="5" width="10" height="2"/>
  <rect x="1" y="7" width="14" height="2"/>
  <rect x="7" y="9" width="2" height="2"/>
  <rect x="7" y="12" width="2" height="2"/></>,
  predict: <><rect x="2" y="12" width="2" height="2"/>
  <rect x="4" y="10" width="2" height="2"/>
  <rect x="6" y="8" width="2" height="2"/>
  <rect x="8" y="6" width="2" height="2"/>
  <rect x="10" y="8" width="2" height="2"/>
  <rect x="12" y="4" width="2" height="2"/>
  <rect x="12" y="2" width="2" height="2"/>
  <rect x="10" y="2" width="2" height="2"/></>,
  correct: <><rect x="2" y="8" width="2" height="2"/>
  <rect x="4" y="10" width="2" height="2"/>
  <rect x="6" y="12" width="2" height="2"/>
  <rect x="8" y="10" width="2" height="2"/>
  <rect x="10" y="8" width="2" height="2"/>
  <rect x="12" y="6" width="2" height="2"/>
  <rect x="14" y="4" width="2" height="2"/></>,
  disagree: <><rect x="7" y="2" width="2" height="8"/>
  <rect x="7" y="12" width="2" height="2"/></>,
  sort_up: <><rect x="7" y="2" width="2" height="12"/>
  <rect x="5" y="4" width="2" height="2"/>
  <rect x="9" y="4" width="2" height="2"/>
  <rect x="3" y="6" width="2" height="2"/>
  <rect x="11" y="6" width="2" height="2"/></>,
  sort_down: <><rect x="7" y="2" width="2" height="12"/>
  <rect x="5" y="10" width="2" height="2"/>
  <rect x="9" y="10" width="2" height="2"/>
  <rect x="3" y="8" width="2" height="2"/>
  <rect x="11" y="8" width="2" height="2"/></>,
  matrix: <><rect x="1" y="1" width="4" height="4"/>
  <rect x="6" y="1" width="4" height="4"/>
  <rect x="11" y="1" width="4" height="4"/>
  <rect x="1" y="6" width="4" height="4"/>
  <rect x="6" y="6" width="4" height="4"/>
  <rect x="11" y="6" width="4" height="4"/>
  <rect x="1" y="11" width="4" height="4"/>
  <rect x="6" y="11" width="4" height="4"/>
  <rect x="11" y="11" width="4" height="4"/></>,
  radar: <><rect x="7" y="1" width="2" height="14"/>
  <rect x="1" y="7" width="14" height="2"/>
  <rect x="3" y="3" width="2" height="2"/>
  <rect x="11" y="3" width="2" height="2"/>
  <rect x="3" y="11" width="2" height="2"/>
  <rect x="11" y="11" width="2" height="2"/>
  <rect x="6" y="6" width="4" height="4"/></>,
  calibration: <><rect x="2" y="12" width="12" height="2"/>
  <rect x="2" y="2" width="2" height="12"/>
  <rect x="4" y="10" width="2" height="2"/>
  <rect x="6" y="6" width="2" height="6"/>
  <rect x="8" y="8" width="2" height="4"/>
  <rect x="10" y="4" width="2" height="8"/>
  <rect x="12" y="2" width="2" height="10"/></>,
}

export type PixelIconName = keyof typeof ICONS

interface Props {
  name: string
  size?: number
  color?: string
  className?: string
  title?: string
  style?: React.CSSProperties
}

export function PixelIcon({ name, size = 16, color = 'currentColor', className, title, style }: Props) {
  const paths = ICONS[name]
  if (!paths) return <span style={{ display: 'inline-block', width: size, height: size, ...style }}>{name}</span>

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill={color}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', imageRendering: 'pixelated', ...style }}
      role="img"
      aria-label={title ?? name}
    >
      {title && <title>{title}</title>}
      {paths}
    </svg>
  )
}
