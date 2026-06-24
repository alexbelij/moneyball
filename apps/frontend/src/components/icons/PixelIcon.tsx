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
  github: <><path fillRule="evenodd" clipRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></>,
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
