import {
  PARAM_BOUNDS,
  clamp,
  deltaMagnitude,
  type AgentParams,
  type ParamDelta,
  type TopicId,
} from '../params/AgentParams.js';
import type { PredictionEvent } from '../events/types.js';
import { computeMetrics, type ReflectionMetrics } from './metrics.js';

/**
 * Deterministic, LLM-free reflection. Consumes resolved predictions, produces
 * clamped ParamDeltas + a rollback recommendation. Pure (no I/O).
 *
 * Signal separation (do not violate):
 *   - resolved outcomes  → confidenceBias / topicMultiplier (calibration)
 *   - user disagrees     → hedgingLevel ONLY (a disagree is not an error)
 */

export interface ReflectionConfig {
  readonly learningRate: number;
  readonly minSamplesGlobal: number;
  readonly minSamplesPerTopic: number;
  /** |calibrationGap| above this triggers a confidenceBias correction. */
  readonly calibrationGapThreshold: number;
  /** Topic Brier must exceed overall Brier by this much to be corrected. */
  readonly topicBrierExcessThreshold: number;
  readonly disagreeRateThreshold: number;
  /** Total |delta| budget per sleep — prevents oscillation. */
  readonly maxTotalDelta: number;
  /** Sleeps a topic stays untouchable after being adjusted. */
  readonly topicCooldownSleeps: number;
  /** Max share of disagree weight a single user can contribute. */
  readonly maxDisagreeShareByUser: number;
  /** Shadow eval: rollback if Brier(vNew) > Brier(vPrev) + this. */
  readonly rollbackBrierExcess: number;
  /** Shadow eval: min samples on BOTH versions before rollback is allowed. */
  readonly rollbackMinSamples: number;
}

export const DEFAULT_REFLECTION_CONFIG: ReflectionConfig = {
  learningRate: 0.15,
  minSamplesGlobal: 20,
  minSamplesPerTopic: 20,
  calibrationGapThreshold: 0.05,
  topicBrierExcessThreshold: 0.04,
  disagreeRateThreshold: 0.35,
  maxTotalDelta: 0.1,
  topicCooldownSleeps: 2,
  maxDisagreeShareByUser: 0.2,
  rollbackBrierExcess: 0.05,
  rollbackMinSamples: 15,
};

export interface ReflectionInput {
  readonly params: AgentParams;
  /** Resolved events collected since the last sleep watermark. */
  readonly events: readonly PredictionEvent[];
  /** topic → remaining cooldown sleeps (from SleepState). */
  readonly topicCooldowns: Readonly<Record<TopicId, number>>;
}

export interface ReflectionResult {
  readonly metrics: ReflectionMetrics;
  readonly deltas: readonly ParamDelta[];
  readonly diagnosis: string;
  /** Topics adjusted this run — SleepWorker writes cooldowns into SleepState. */
  readonly adjustedTopics: readonly TopicId[];
  /** Shadow eval verdict: current params version measurably worse than previous. */
  readonly rollbackRecommended: boolean;
}

export class ReflectionEngine {
  constructor(private readonly cfg: ReflectionConfig = DEFAULT_REFLECTION_CONFIG) {}

  get config(): ReflectionConfig {
    return this.cfg;
  }

  reflect(input: ReflectionInput): ReflectionResult {
    const { params, events, topicCooldowns } = input;
    const metrics = computeMetrics(events, {
      maxDisagreeShareByUser: this.cfg.maxDisagreeShareByUser,
    });

    const rollbackRecommended = this.evaluateShadow(metrics, params.version);
    if (rollbackRecommended) {
      // Rollback supersedes any new deltas this cycle.
      return {
        metrics,
        deltas: [],
        diagnosis: this.renderRollbackDiagnosis(metrics, params.version),
        adjustedTopics: [],
        rollbackRecommended: true,
      };
    }

    const candidates: ParamDelta[] = [];
    const adjustedTopics: TopicId[] = [];

    // 1) Global calibration: systematic over/underconfidence.
    if (
      metrics.nResolved >= this.cfg.minSamplesGlobal &&
      Math.abs(metrics.calibrationGap) > this.cfg.calibrationGapThreshold
    ) {
      const step = clamp(-this.cfg.learningRate * metrics.calibrationGap, -0.05, 0.05);
      const to = clamp(
        params.confidenceBias + step,
        PARAM_BOUNDS.confidenceBias.min,
        PARAM_BOUNDS.confidenceBias.max,
      );
      if (to !== params.confidenceBias) {
        candidates.push({ kind: 'confidenceBias', from: params.confidenceBias, to });
      }
    }

    // 2) Per-topic calibration: topics consistently worse than baseline.
    for (const [topic, stats] of Object.entries(metrics.byTopic)) {
      if (stats.n < this.cfg.minSamplesPerTopic) continue;
      if ((topicCooldowns[topic] ?? 0) > 0) continue;
      const excess = stats.brier - metrics.brierOverall;
      if (excess <= this.cfg.topicBrierExcessThreshold) continue;

      const current = params.topicCalibration[topic]?.multiplier ?? 1.0;
      const to = clamp(
        current - this.cfg.learningRate * excess * 2,
        PARAM_BOUNDS.topicMultiplier.min,
        PARAM_BOUNDS.topicMultiplier.max,
      );
      if (to !== current) {
        candidates.push({
          kind: 'topicMultiplier',
          topic,
          from: current,
          to,
          sampleSize: stats.n,
        });
        adjustedTopics.push(topic);
      }
    }

    // 3) Disagree pressure → hedging only. Never touches calibration.
    if (
      metrics.nResolved >= this.cfg.minSamplesGlobal &&
      metrics.disagreeRateOverall > this.cfg.disagreeRateThreshold
    ) {
      const to = clamp(
        params.hedgingLevel + 0.1,
        PARAM_BOUNDS.hedgingLevel.min,
        PARAM_BOUNDS.hedgingLevel.max,
      );
      if (to !== params.hedgingLevel) {
        candidates.push({ kind: 'hedgingLevel', from: params.hedgingLevel, to });
      }
    }

    const deltas = this.enforceDeltaBudget(candidates);
    const keptTopics = new Set(
      deltas.flatMap((d) => (d.kind === 'topicMultiplier' ? [d.topic] : [])),
    );

    return {
      metrics,
      deltas,
      diagnosis: this.renderDiagnosis(metrics, deltas),
      adjustedTopics: adjustedTopics.filter((t) => keptTopics.has(t)),
      rollbackRecommended: false,
    };
  }

  /** Keep highest-impact deltas within the per-sleep budget. */
  private enforceDeltaBudget(candidates: readonly ParamDelta[]): readonly ParamDelta[] {
    const sorted = [...candidates].sort((a, b) => deltaMagnitude(b) - deltaMagnitude(a));
    const kept: ParamDelta[] = [];
    let budget = this.cfg.maxTotalDelta;
    for (const delta of sorted) {
      const magnitude = deltaMagnitude(delta);
      if (magnitude <= budget) {
        kept.push(delta);
        budget -= magnitude;
      }
    }
    return kept;
  }

  /**
   * Shadow evaluation: compare Brier of the current params version vs the
   * previous one on events resolved in this window. Both must have enough
   * samples; otherwise we don't judge.
   */
  private evaluateShadow(metrics: ReflectionMetrics, currentVersion: number): boolean {
    if (currentVersion === 0) return false;
    const current = metrics.byParamsVersion[currentVersion];
    const previous = metrics.byParamsVersion[currentVersion - 1];
    if (!current || !previous) return false;
    if (
      current.n < this.cfg.rollbackMinSamples ||
      previous.n < this.cfg.rollbackMinSamples
    ) {
      return false;
    }
    return current.brier > previous.brier + this.cfg.rollbackBrierExcess;
  }

  private renderDiagnosis(
    metrics: ReflectionMetrics,
    deltas: readonly ParamDelta[],
  ): string {
    if (deltas.length === 0) {
      return `No actionable patterns: n=${metrics.nResolved}, Brier=${metrics.brierOverall.toFixed(3)}, gap=${metrics.calibrationGap.toFixed(3)}.`;
    }
    const parts = deltas.map((d) => {
      switch (d.kind) {
        case 'confidenceBias':
          return `calibration gap ${metrics.calibrationGap.toFixed(3)} → confidenceBias ${d.from.toFixed(3)}→${d.to.toFixed(3)}`;
        case 'topicMultiplier':
          return `topic "${d.topic}" Brier excess (n=${d.sampleSize}) → multiplier ${d.from.toFixed(2)}→${d.to.toFixed(2)}`;
        case 'hedgingLevel':
          return `disagree rate ${metrics.disagreeRateOverall.toFixed(2)} → hedging ${d.from.toFixed(2)}→${d.to.toFixed(2)}`;
      }
    });
    return `Window n=${metrics.nResolved}, Brier=${metrics.brierOverall.toFixed(3)}. ${parts.join('; ')}.`;
  }

  private renderRollbackDiagnosis(metrics: ReflectionMetrics, version: number): string {
    const current = metrics.byParamsVersion[version];
    const previous = metrics.byParamsVersion[version - 1];
    return (
      `Shadow eval: params v${version} Brier=${current?.brier.toFixed(3)} (n=${current?.n}) ` +
      `worse than v${version - 1} Brier=${previous?.brier.toFixed(3)} (n=${previous?.n}) — rollback.`
    );
  }
}
