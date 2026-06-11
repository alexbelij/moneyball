import type { TopicId } from '../params/AgentParams.js';
import type { PredictionEvent } from '../events/types.js';

/**
 * Deterministic metric computation over a window of RESOLVED predictions.
 * Pure functions, no I/O — trivially unit-testable.
 */

export interface CalibrationBucket {
  readonly lo: number;
  readonly hi: number;
  readonly meanPredicted: number;
  readonly hitRate: number;
  readonly n: number;
}

export interface TopicStats {
  readonly brier: number;
  readonly n: number;
  readonly disagreeRate: number;
}

export interface VersionStats {
  readonly brier: number;
  readonly n: number;
}

export interface ReflectionMetrics {
  readonly windowFrom: string;
  readonly windowTo: string;
  readonly nResolved: number;
  /** Mean (effectiveConfidence - outcome)^2 over the window. Lower is better. */
  readonly brierOverall: number;
  /**
   * n-weighted mean of (meanPredicted - hitRate) across buckets.
   * > 0 → systematic overconfidence, < 0 → underconfidence.
   */
  readonly calibrationGap: number;
  readonly buckets: readonly CalibrationBucket[];
  readonly byTopic: Readonly<Record<TopicId, TopicStats>>;
  /** Disagree rate with per-user weight capping (anti-gaming). */
  readonly disagreeRateOverall: number;
  /** Brier per paramsVersion — input for shadow rollback evaluation. */
  readonly byParamsVersion: Readonly<Record<number, VersionStats>>;
}

const BUCKET_EDGES = [0, 0.2, 0.4, 0.6, 0.8, 1.0000001] as const;

export function computeMetrics(
  events: readonly PredictionEvent[],
  opts: { readonly maxDisagreeShareByUser: number },
): ReflectionMetrics {
  const resolved = events.filter(
    (e): e is PredictionEvent & { outcome: NonNullable<PredictionEvent['outcome']> } =>
      e.outcome !== null,
  );

  const empty: ReflectionMetrics = {
    windowFrom: '',
    windowTo: '',
    nResolved: 0,
    brierOverall: 0,
    calibrationGap: 0,
    buckets: [],
    byTopic: {},
    disagreeRateOverall: 0,
    byParamsVersion: {},
  };
  if (resolved.length === 0) return empty;

  const brierOf = (e: (typeof resolved)[number]): number => {
    const outcome = e.outcome.correct ? 1 : 0;
    return (e.effectiveConfidence - outcome) ** 2;
  };

  const brierOverall = mean(resolved.map(brierOf));

  // --- Calibration buckets -------------------------------------------------
  const buckets: CalibrationBucket[] = [];
  for (let i = 0; i < BUCKET_EDGES.length - 1; i++) {
    const lo = BUCKET_EDGES[i] as number;
    const hi = BUCKET_EDGES[i + 1] as number;
    const inBucket = resolved.filter(
      (e) => e.effectiveConfidence >= lo && e.effectiveConfidence < hi,
    );
    if (inBucket.length === 0) continue;
    buckets.push({
      lo,
      hi: Math.min(hi, 1),
      meanPredicted: mean(inBucket.map((e) => e.effectiveConfidence)),
      hitRate: mean(inBucket.map((e) => (e.outcome.correct ? 1 : 0))),
      n: inBucket.length,
    });
  }
  const totalN = buckets.reduce((s, b) => s + b.n, 0);
  const calibrationGap =
    totalN === 0
      ? 0
      : buckets.reduce((s, b) => s + (b.meanPredicted - b.hitRate) * b.n, 0) / totalN;

  // --- Per-topic stats ------------------------------------------------------
  const byTopic: Record<TopicId, TopicStats> = {};
  for (const topic of new Set(resolved.map((e) => e.topic))) {
    const ofTopic = resolved.filter((e) => e.topic === topic);
    byTopic[topic] = {
      brier: mean(ofTopic.map(brierOf)),
      n: ofTopic.length,
      disagreeRate: cappedDisagreeRate(ofTopic, opts.maxDisagreeShareByUser),
    };
  }

  // --- Per-paramsVersion stats (shadow eval) --------------------------------
  const byParamsVersion: Record<number, VersionStats> = {};
  for (const version of new Set(resolved.map((e) => e.paramsVersion))) {
    const ofVersion = resolved.filter((e) => e.paramsVersion === version);
    byParamsVersion[version] = { brier: mean(ofVersion.map(brierOf)), n: ofVersion.length };
  }

  const sortedByResolved = [...resolved].sort((a, b) =>
    a.outcome.resolvedAt.localeCompare(b.outcome.resolvedAt),
  );
  const first = sortedByResolved[0];
  const last = sortedByResolved[sortedByResolved.length - 1];

  return {
    windowFrom: first ? first.outcome.resolvedAt : '',
    windowTo: last ? last.outcome.resolvedAt : '',
    nResolved: resolved.length,
    brierOverall,
    calibrationGap,
    buckets,
    byTopic,
    disagreeRateOverall: cappedDisagreeRate(resolved, opts.maxDisagreeShareByUser),
    byParamsVersion,
  };
}

/**
 * Disagree rate where a single userId contributes at most `maxShare` of the
 * total disagree weight — one hostile/noisy user cannot steer evolution.
 */
function cappedDisagreeRate(
  events: readonly PredictionEvent[],
  maxShare: number,
): number {
  if (events.length === 0) return 0;
  const perUser = new Map<string, number>();
  for (const e of events) {
    if (e.disagree !== null) {
      perUser.set(e.disagree.userId, (perUser.get(e.disagree.userId) ?? 0) + 1);
    }
  }
  const cap = Math.max(1, Math.floor(events.length * maxShare));
  let weighted = 0;
  for (const count of perUser.values()) weighted += Math.min(count, cap);
  return weighted / events.length;
}

function mean(xs: readonly number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}
