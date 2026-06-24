/**
 * judgeRoute | v1.0.0 | 2026-06-24
 * Purpose: Pure helpers for the judge deep-link hash (#/judge). The judge
 *          overlay is the one surface that MUST open on a cold load (judges
 *          paste the link), so its hash parsing is deliberately tolerant and
 *          kept independent of navSections.
 */

/** Canonical shareable hash for the judge page. */
export const JUDGE_HASH = '#/judge' as const

/**
 * True when a location.hash points at the judge page. Tolerates a leading
 * '#', '#/', trailing slashes, and case (e.g. '#judge', '#/Judge/', '#/JUDGE').
 */
export function isJudgeHash(hash: string | null | undefined): boolean {
  if (!hash) return false
  const slug = hash.replace(/^#\/?/, '').replace(/\/+$/, '').trim().toLowerCase()
  return slug === 'judge'
}
