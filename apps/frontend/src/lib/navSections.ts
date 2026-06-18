/**
 * navSections | v1.0.0 | 2026-06-17
 * Purpose: Pure, testable definitions for the cabinet's overlay navigation
 *          (T51). One scene, sections rendered as overlay panels — never a
 *          routed page reload. Hash routes (#/about) exist only so a section
 *          can be deep-linked / shared.
 *
 * Sections: About · How it works · Methodology · Verify on Walrus ·
 *           Leaderboard · Connected agents (T54 placeholder).
 */

export type SectionId =
  | 'about'
  | 'how-it-works'
  | 'methodology'
  | 'verify'
  | 'leaderboard'
  | 'connected'

export interface NavSection {
  /** Stable id; also the hash slug (#/<id>). */
  id: SectionId
  /** Menu label (short). */
  label: string
  /** Panel title (longer). */
  title: string
  /** False => section is a teaser placeholder (e.g. Connected agents / T54). */
  available: boolean
}

/** Ordered list shown in the pixel menu. */
export const NAV_SECTIONS: readonly NavSection[] = [
  { id: 'about', label: 'About', title: 'About Moneyball', available: true },
  { id: 'how-it-works', label: 'How it works', title: 'How it works', available: true },
  { id: 'methodology', label: 'Methodology', title: 'Methodology', available: true },
  { id: 'verify', label: 'Verify on Walrus', title: 'Verify on Walrus', available: true },
  { id: 'leaderboard', label: 'Leaderboard', title: 'Leaderboard', available: true },
  { id: 'connected', label: 'Connected agents', title: 'Connected agents', available: false },
] as const

const BY_ID: Record<SectionId, NavSection> = NAV_SECTIONS.reduce(
  (acc, s) => {
    acc[s.id] = s
    return acc
  },
  {} as Record<SectionId, NavSection>,
)

/** Lookup a section by id (undefined if unknown). */
export function getSection(id: string | null | undefined): NavSection | undefined {
  if (!id) return undefined
  return BY_ID[id as SectionId]
}

/** True if the string is a known section id. */
export function isSectionId(id: string | null | undefined): id is SectionId {
  return !!id && id in BY_ID
}

/** Section id -> shareable hash, e.g. 'about' -> '#/about'. */
export function sectionToHash(id: SectionId): string {
  return `#/${id}`
}

/**
 * Parse a location.hash into a section id, or null if it does not match a
 * known section. Tolerates leading '#', '#/', and trailing slashes.
 */
export function hashToSection(hash: string | null | undefined): SectionId | null {
  if (!hash) return null
  const slug = hash.replace(/^#\/?/, '').replace(/\/+$/, '').trim().toLowerCase()
  return isSectionId(slug) ? slug : null
}
