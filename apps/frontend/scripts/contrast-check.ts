/**
 * contrast-check | v1.0.0 | 2026-06-14
 * T46 — WCAG AA contrast verification for all text/accent tokens against
 * the primary dark background (palette.wood900).
 *
 * Run standalone:  npx tsx scripts/contrast-check.ts
 * Also imported by test/contrastWcag.test.ts for CI enforcement.
 */

/* ── WCAG 2.1 relative-luminance helpers ─────────────────────────── */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function linearize(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

/**
 * WCAG 2.1 contrast ratio between two hex colours.
 * Returns a value ≥ 1.0 (always lighter / darker, order-independent).
 */
export function contrastRatio(fg: string, bg: string): number {
  let l1 = relativeLuminance(fg)
  let l2 = relativeLuminance(bg)
  if (l1 < l2) [l1, l2] = [l2, l1]
  return (l1 + 0.05) / (l2 + 0.05)
}

/* ── Token pairs to check ────────────────────────────────────────── */

export interface ContrastPair {
  name: string
  fg: string
  bg: string
  /** WCAG AA threshold: 4.5 for normal text, 3.0 for large text / UI. */
  threshold: number
}

/**
 * Build the full list of contrast pairs from token values.
 * Accepts the tokens as plain objects so the script can run without Vite.
 */
export function buildContrastPairs(opts: {
  wood900: string
  textPrimary: string
  textDim: string
  textMuted: string
  textFaint: string
  agentColors: Record<string, string>
  accentGold: string
  accentRed: string
  accentGreen: string
}): ContrastPair[] {
  const bg = opts.wood900
  const pairs: ContrastPair[] = [
    { name: 'text.primary on wood900', fg: opts.textPrimary, bg, threshold: 4.5 },
    { name: 'text.dim on wood900',     fg: opts.textDim,     bg, threshold: 4.5 },
    { name: 'text.muted on wood900',   fg: opts.textMuted,   bg, threshold: 4.5 },
    { name: 'text.faint on wood900',   fg: opts.textFaint,   bg, threshold: 4.5 },
    { name: 'accent.gold on wood900',  fg: opts.accentGold,  bg, threshold: 4.5 },
    { name: 'accent.red on wood900',   fg: opts.accentRed,   bg, threshold: 3.0 },
    { name: 'accent.green on wood900', fg: opts.accentGreen, bg, threshold: 4.5 },
  ]
  for (const [id, color] of Object.entries(opts.agentColors)) {
    pairs.push({
      name: `agent ${id} on wood900`,
      fg: color,
      bg,
      threshold: 4.5,
    })
  }
  return pairs
}

export interface ContrastResult extends ContrastPair {
  ratio: number
  pass: boolean
}

export function checkContrast(pairs: ContrastPair[]): ContrastResult[] {
  return pairs.map((p) => {
    const ratio = contrastRatio(p.fg, p.bg)
    return { ...p, ratio, pass: ratio >= p.threshold }
  })
}

/* ── CLI entry ───────────────────────────────────────────────────── */

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('contrast-check.ts')) {
  // Direct values (avoid importing tokens which need Vite)
  const results = checkContrast(buildContrastPairs({
    wood900:     '#181009',
    textPrimary: '#f4ede2',
    textDim:     '#d5cec0',
    textMuted:   '#9e7c54',
    textFaint:   '#a5845c',
    accentGold:  '#e8a44a',
    accentRed:   '#c03030',
    accentGreen: '#39c04a',
    agentColors: {
      dr_morgan:     '#e8a44a',
      scout_alvarez: '#4aade8',
      viktor_kane:   '#d45555',
      sofia_mendes:  '#7ae84a',
      madame_pythia: '#d64ae8',
    },
  }))

  let allPass = true
  for (const r of results) {
    const mark = r.pass ? 'PASS' : 'FAIL'
    if (!r.pass) allPass = false
    console.log(`[${mark}] ${r.name}: ${r.ratio.toFixed(2)}:1 (need ${r.threshold}:1) ${r.fg} on ${r.bg}`)
  }
  process.exit(allPass ? 0 : 1)
}
