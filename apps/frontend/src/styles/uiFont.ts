/**
 * uiFont.ts | 2026-06-24
 * Purpose: Font-switcher plumbing for the FontPanel (body font family + size
 * scale). Pure helpers with NO store import so uiPrefs can import this without
 * a cycle. All fonts are self-hosted (see public/assets/fonts/fonts.css).
 */

export type FontChoice = 'vt323' | 'silkscreen' | 'plex'

/** CSS font stacks per choice — used for both HTML (var) and Phaser text. */
export const FONT_STACKS: Record<FontChoice, string> = {
  vt323: '"VT323", "Press Start 2P", monospace',
  silkscreen: '"Silkscreen", "VT323", monospace',
  plex: '"IBM Plex Mono", "VT323", monospace',
}

/** Header/title stacks per choice. VT323 (default) keeps the "Press Start 2P"
 *  arcade headers; picking a readable face also restyles the titles so the
 *  switch is unmistakable (not just the small body text). */
export const HEAD_STACKS: Record<FontChoice, string> = {
  vt323: '"Press Start 2P", monospace',
  silkscreen: '"Silkscreen", "Press Start 2P", monospace',
  plex: '"IBM Plex Mono", "Press Start 2P", monospace',
}

/** Human labels for the panel. */
export const FONT_LABELS: Record<FontChoice, string> = {
  vt323: 'VT323',
  silkscreen: 'Silkscreen',
  plex: 'IBM Plex Mono',
}

/** Discrete size steps (multiplies the px scale via --mb-font-scale). */
export const FONT_SCALES = [1, 1.15, 1.3] as const
export type FontScale = (typeof FONT_SCALES)[number]
export const SCALE_LABELS: Record<string, string> = {
  '1': 'S',
  '1.15': 'M',
  '1.3': 'L',
}

export const DEFAULT_FONT: FontChoice = 'vt323'
export const DEFAULT_SCALE: FontScale = 1

/** Push the active font + size onto the document root as CSS variables. */
export function applyFontVars(choice: FontChoice, scale: number): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--mb-font-body', FONT_STACKS[choice] ?? FONT_STACKS[DEFAULT_FONT])
  root.style.setProperty('--mb-font-head', HEAD_STACKS[choice] ?? HEAD_STACKS[DEFAULT_FONT])
  root.style.setProperty('--mb-font-scale', String(scale))
  // Eagerly load the chosen faces so already-painted text swaps instantly
  // (no lingering on the fallback while the woff2 lazy-loads on first use).
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      const fams = choice === 'silkscreen' ? ['Silkscreen']
        : choice === 'plex' ? ['IBM Plex Mono']
        : ['VT323']
      for (const fam of fams) {
        void (document as Document).fonts.load(`16px "${fam}"`)
        void (document as Document).fonts.load(`700 16px "${fam}"`)
      }
    } catch {
      /* font loading is best-effort */
    }
  }
}

/** Phaser text uses the same stack (Phaser accepts comma-separated families). */
export function phaserFont(choice: FontChoice): string {
  return FONT_STACKS[choice] ?? FONT_STACKS[DEFAULT_FONT]
}
