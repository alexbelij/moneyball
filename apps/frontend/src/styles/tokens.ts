/**
 * tokens | v1.2.0 | 2026-06-14
 * Purpose: Single source of truth for design-spec palette, typography,
 * spacing, border, shadow, and z-index tokens.
 *
 * T49: typography scale (fontSize + lineHeight ramp); breakpoint constant.
 * T35: added semantic `overlay` scrim token.
 * Canonical reference: docs/design-spec.md v1.0.0
 * Rule: grep for raw `#` hex in src/components/ should yield ≈ 0 results
 *       after migration. Every colour must come from this module.
 */

/* ══════════════════════════════════════════════════════════════════════
 * §2 — PALETTE (sampled from room_bg_v02, exact design-spec values)
 * ══════════════════════════════════════════════════════════════════════ */

export const palette = {
  /** Letterbox / CRT off. */
  bgBlack:    '#000000',
  /** Dark panel surface (slightly lifted from true black). */
  surface:    '#0c0c0c',

  wallGreen:  '#122116',
  wallGreen2: '#1d311f',

  wood900:    '#181009',
  wood700:    '#341d0e',
  wood500:    '#4e2912',
  wood300:    '#876845',
  wood200:    '#9e7c54',
  wood100:    '#ac885e',

  paper:      '#f4ede2',
  paperBright:'#fffcf5',
} as const

/* ── Accent colours (signals only — never large fills) ───────────── */

export const accents = {
  /** Desk-lamp amber / primary call-to-action. */
  gold:  '#e8a44a',
  /** Exit-sign red / danger / incorrect. WCAG AA ≥ 4.5:1 on wood700/wood900. */
  red:   '#e85c5c',
  /** LCD/LED green / success / correct. */
  green: '#39c04a',
} as const

/* ── Semantic text helpers ────────────────────────────────────────
 * T46: text.muted and text.faint decoupled from palette wood tones
 *      and brightened to pass WCAG AA ≥ 4.5:1 on wood700 AND wood900.
 *      palette.wood500 / wood300 are still available for borders/fills.
 * ─────────────────────────────────────────────────────────────────── */

export const text = {
  /** Primary text on dark backgrounds. */
  primary:  palette.paper,
  /** Slightly muted text. */
  dim:      '#d5cec0',
  /** Secondary / label text. WCAG AA ≥ 4.5:1 on wood700/wood900. */
  muted:    '#b08a5e',
  /** Very dim (captions, meta). WCAG AA 5.42:1 on wood900. */
  faint:    '#a5845c',
} as const

/* ── Overlay / scrim (modal & wallet-flow backdrops) ─────────────── */

/** Semi-transparent backdrop behind modals and the wallet-flow freeze. */
export const overlay = 'rgba(0,0,0,0.6)' as const

/* ── Per-agent accent colours (series / badges) ──────────────────── */

export const agentColors: Record<string, string> = {
  dr_morgan:     '#e8a44a',
  scout_alvarez: '#4aade8',
  viktor_kane:   '#d45555',
  sofia_mendes:  '#7ae84a',
  madame_pythia: '#d64ae8',
} as const

/* ══════════════════════════════════════════════════════════════════════
 * §3 — TYPOGRAPHY (self-hosted woff2, NO CDN)
 * ══════════════════════════════════════════════════════════════════════ */

export const fonts = {
  /** Sparingly — headers, HUD labels. */
  header: '"Press Start 2P", monospace',
  /** Body / data / tables. */
  body:   '"VT323", "Press Start 2P", monospace',
} as const

/**
 * T49: Typography scale — fontSize + lineHeight pairs.
 * Rules:
 *   - Minimum font size: 14px everywhere (thick pixel fonts are unreadable below).
 *   - Press Start 2P (fonts.header): only `hdr*` sizes (≥ 16px, short labels).
 *   - VT323 (fonts.body): `body*` / `data*` / `caption` sizes (≥ 14px).
 *   - Never use fonts.header with body/data sizes.
 */
export const type = {
  /* ── Header scale (Press Start 2P — short labels only) ────────── */
  /** Large header: 14px (used sparingly). */
  hdrLg:    { fontSize: 22, lineHeight: '28px' },
  /** Standard header (section titles, HUD labels). */
  hdr:      { fontSize: 18, lineHeight: '24px' },
  /** Small header (stat labels, tab badges). */
  hdrSm:    { fontSize: 16, lineHeight: '22px' },
  /** Table header (dense column headers). */
  hdrXs:    { fontSize: 16, lineHeight: '22px' },

  /* ── Body scale (VT323 — body, data, captions) ────────────────── */
  /** Large body text. */
  bodyLg:   { fontSize: 22, lineHeight: '28px' },
  /** Standard body / paragraphs. */
  body:     { fontSize: 18, lineHeight: '24px' },
  /** Data values / table cells. */
  data:     { fontSize: 18, lineHeight: '22px' },
  /** Smaller data / secondary. */
  dataSm:   { fontSize: 16, lineHeight: '20px' },
  /** Captions / timestamps. */
  caption:  { fontSize: 16, lineHeight: '22px' },

  /* ── SVG scale (chart axes, diagram labels — smaller is OK) ───── */
  /** SVG axis / tick labels. */
  svgAxis:  { fontSize: 14 },
  /** SVG sub-labels / annotations. */
  svgLabel: { fontSize: 14 },
  /** SVG tiny dot / indicator (e.g. ● legend). */
  svgDot:   { fontSize: 14 },
} as const

/** Responsive breakpoint — mobile-first at 480px. */
export const BP_MOBILE = 480

/* ══════════════════════════════════════════════════════════════════════
 * §4 — COMPONENTS (SNES dialog language)
 * ══════════════════════════════════════════════════════════════════════ */

/** 8px base spacing grid. Use multiples: 8, 16, 24, 32… */
export const GRID = 8

/** Spacing scale (multiples of GRID). */
export const spacing = {
  xs: 4,        // half-grid, use sparingly
  sm: GRID,     // 8
  md: GRID * 2, // 16
  lg: GRID * 3, // 24
  xl: GRID * 4, // 32
} as const

/** 2px hard borders, border-radius: 0. */
export const borders = {
  width: 2,
  radius: 0,
  /** Standard panel/card border. */
  standard: `2px solid ${palette.wood700}`,
  /** Thin rule (table rows, dividers). */
  rule: `1px solid ${palette.wood700}`,
} as const

/** Chart grid colour (subtle scanline). */
export const chartGrid = '#2a2a2a'

/**
 * SNES-style bevel: bright top-left (wood-100), dark bottom-right (wood-900).
 * Hard offset shadow (no blur).
 */
export const shadows = {
  /** Large panel / modal. */
  hard:        `4px 4px 0 ${palette.bgBlack}`,
  /** Small card / toast. */
  hardSmall:   `2px 2px 0 ${palette.bgBlack}`,
  /** Inset bevel for buttons. */
  bevelInset:  `inset 1px 1px 0 rgba(244,237,226,0.12), inset -1px -1px 0 rgba(0,0,0,0.3)`,
  /** Pressed state inset. */
  bevelPress:  `inset -1px -1px 0 rgba(244,237,226,0.08), inset 1px 1px 0 rgba(0,0,0,0.4)`,
} as const

/* ══════════════════════════════════════════════════════════════════════
 * Z-INDEX LAYERS
 * ══════════════════════════════════════════════════════════════════════ */

export const zIndex = {
  /** Base game / phaser canvas. */
  base:     0,
  /** Loading skeleton. */
  loading:  50,
  /** HUD status (top-left). */
  hud:      50,
  /** Match TV ticker. */
  matchTV:  55,
  /** HUD wallet (top-right). */
  hudRight: 60,
  /** StatsBoard / leaderboard. */
  stats:    65,
  /** Agent modal / dossier. */
  modal:    70,
  /** HUD error. */
  hudError: 70,
  /** Debug panel. */
  debug:    100,
  /** Pixel modal overlay. */
  overlay:  100,
  /** Toast notifications. */
  toast:    200,
  /** Wallet flow freeze. */
  wallet:   999,
  /** Persistent controls (lite toggle, offline banner). */
  topmost:  9999,
  /** Dropdown / select menus. */
  dropdown: 2000,
} as const

/* ══════════════════════════════════════════════════════════════════════
 * CONVENIENCE: flat namespace re-export for terse inline styles
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * Flat token object for inline-style usage.
 * Prefer named imports above for tree-shaking.
 * Usage: `import { T } from '@/styles/tokens'; ... color: T.paper`
 */
export const T = {
  // Palette
  ...palette,
  // Accents
  gold:        accents.gold,
  red:         accents.red,
  green:       accents.green,
  // Text
  textPrimary: text.primary,
  textDim:     text.dim,
  textMuted:   text.muted,
  textFaint:   text.faint,
  // Fonts
  fontHeader:  fonts.header,
  fontBody:    fonts.body,
  // Borders
  border:      borders.standard,
  borderRule:  borders.rule,
  // Shadows
  shadow:      shadows.hard,
  shadowSm:    shadows.hardSmall,
  // Overlay
  overlay,
  // Chart
  chartGrid,
  // Type scale
  type,
  BP_MOBILE,
} as const
