/**
 * formatDate | v1.0.0 | 2026-06-17
 * Purpose: Locale-aware numeric date formatting that avoids locale-specific
 * month names (e.g. "июн" in Russian) which break monospace alignment.
 * Uses Intl.DateTimeFormat with numeric-only options so output is always
 * digits + separators — consistent width across all locales.
 */

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
})

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

const dateOnlyFormatter = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: '2-digit',
})

const fullFormatter = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * Format a match kickoff time.
 * - Today → "15:00"
 * - Other days → "18/06 15:00" (locale-dependent order, always numeric)
 */
export function formatKickoff(iso: string): string {
  const d = new Date(iso)
  const isToday = new Date().toDateString() === d.toDateString()
  return isToday ? timeFormatter.format(d) : dateTimeFormatter.format(d)
}

/**
 * Format a date-only value (no time) — "18/06" or "06/18".
 */
export function formatDateShort(iso: string): string {
  return dateOnlyFormatter.format(new Date(iso))
}

/**
 * Format full timestamp for event logs — "18/06/2026 15:00".
 */
export function formatTimestamp(iso: string): string {
  return fullFormatter.format(new Date(iso))
}
