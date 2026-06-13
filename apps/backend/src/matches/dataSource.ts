/**
 * dataSource | v1.0.0 | 2026-06-13
 * Purpose: HONEST, machine-readable provenance of every input the prediction
 * engine consumes (T30). The agents narrate things like "xG model: …", but the
 * underlying numbers are NOT real feeds yet — team strength is a deterministic
 * hash of the team name. This descriptor states that plainly so the UI can show
 * it and judges/users are never misled.
 *
 * Invariant (enforced by tests): nothing here is labelled 'live' until a real
 * feed is actually wired. When you connect real xG/odds, flip the relevant
 * `source` to 'live', update `detail`, and bump MODEL_INPUTS_VERSION.
 */

export type InputSource = 'synthetic' | 'manual' | 'live'

export interface ModelInputField {
  /** Stable key matching the engine variable. */
  key: string
  /** Human label. */
  label: string
  /** Where the value comes from. */
  source: InputSource
  /** Honest one-line explanation of how it is produced. */
  detail: string
}

/** Bump when the provenance of any input changes (e.g. real feed connected). */
export const MODEL_INPUTS_VERSION = 1

export const MODEL_INPUTS: readonly ModelInputField[] = [
  {
    key: 'teamStrength',
    label: 'Team strength',
    source: 'synthetic',
    detail:
      'Deterministic FNV-1a hash of the team name mapped into [0.30, 0.70]. A placeholder for real xG — identical on every run, with no live data behind it.',
  },
  {
    key: 'homeAdvantage',
    label: 'Home advantage',
    source: 'manual',
    detail: 'Fixed +0.04 term added to the home side. A hand-set constant, not measured.',
  },
  {
    key: 'narrativeSentiment',
    label: 'Narrative sentiment',
    source: 'synthetic',
    detail: 'Matchday-salted hash signal. Not sourced from any news, social, or injury feed.',
  },
  {
    key: 'syntheticOdds',
    label: 'Bookmaker odds',
    source: 'synthetic',
    detail: 'Derived from team strength. No live bookmaker odds feed is connected.',
  },
] as const

export interface DataSourceSummary {
  version: number
  /** Top-line honesty statement. */
  headline: string
  inputs: readonly ModelInputField[]
}

export function getDataSourceSummary(): DataSourceSummary {
  return {
    version: MODEL_INPUTS_VERSION,
    headline:
      'Model inputs are synthetic (v1): predictions run on deterministic placeholders, not live data feeds.',
    inputs: MODEL_INPUTS,
  }
}
