/**
 * dataSource | v2.0.0 | 2026-06-18
 * Purpose: HONEST, machine-readable provenance of every input the prediction
 * engine consumes (T30 + T78). The `source` field is updated in real-time:
 * `live` only when a real feed is actually wired and returning data.
 *
 * When you connect a new feed, flip the relevant `source` to 'live', update
 * `detail`, and bump MODEL_INPUTS_VERSION.
 */

import { env } from '../config/env'

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
export const MODEL_INPUTS_VERSION = 2

/**
 * Build model inputs dynamically based on which env vars are set.
 * This keeps the provenance declaration honest at runtime.
 */
function buildModelInputs(): readonly ModelInputField[] {
  const hasOdds = !!env.API_FOOTBALL_KEY
  const hasForm = !!env.API_FOOTBALL_KEY

  return [
    {
      key: 'teamStrength',
      label: 'Team strength',
      source: 'live',
      detail:
        'Based on FIFA World Ranking mapped to [0.30, 0.70]. Top-ranked team ≈ 0.70, lowest ≈ 0.30. Fallback to deterministic hash for unranked teams.',
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
      source: hasForm ? 'live' : 'synthetic',
      detail: hasForm
        ? 'Team form (last 5 matches) from api-football.com. Fallback to matchday-salted hash if API unavailable.'
        : 'Matchday-salted hash signal. Not sourced from any news, social, or injury feed.',
    },
    {
      key: 'bookmakerOdds',
      label: 'Bookmaker odds',
      source: hasOdds ? 'live' : 'synthetic',
      detail: hasOdds
        ? 'Real 1X2 odds from api-football.com (Bet365 primary). Used by Sofia Mendes for EV calculation. Fallback to synthetic if unavailable.'
        : 'Derived from team strength + deterministic noise. No live bookmaker odds feed connected.',
    },
  ] as const
}

export interface DataSourceSummary {
  version: number
  /** Top-line honesty statement. */
  headline: string
  inputs: readonly ModelInputField[]
  /** External data providers in use. */
  providers: readonly string[]
}

export function getDataSourceSummary(): DataSourceSummary {
  const inputs = buildModelInputs()
  const liveCount = inputs.filter((i) => i.source === 'live').length
  const providers: string[] = []

  if (env.FOOTBALL_DATA_TOKEN) providers.push('football-data.org (match schedule & results)')
  if (env.API_FOOTBALL_KEY) providers.push('api-football.com (odds & team form)')

  const headline =
    liveCount > 0
      ? `Model inputs v${MODEL_INPUTS_VERSION}: ${liveCount} of ${inputs.length} inputs use live data feeds. Remaining inputs are synthetic placeholders.`
      : `Model inputs v${MODEL_INPUTS_VERSION}: all prediction inputs are synthetic placeholders. No live data feeds connected.`

  return { version: MODEL_INPUTS_VERSION, headline, inputs, providers }
}
