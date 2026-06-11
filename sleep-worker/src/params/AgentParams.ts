/**
 * AgentParams — the ONLY mutable surface of an agent. Everything the agent can
 * "learn" lives here. Mutations happen exclusively through EvolutionEngine
 * (single writer), are clamped to hard bounds, and are fully versioned.
 */

export type TopicId = string;

export interface TopicCalibration {
  /** Multiplier applied to raw confidence for this topic. */
  readonly multiplier: number;
  /** Number of resolved events this value is based on (audit/debug). */
  readonly sampleSize: number;
}

export interface AgentParams {
  readonly agentId: string;
  /** Monotonically increasing; changes only via EvolutionEvent. */
  readonly version: number;
  /** Additive correction to raw confidence. */
  readonly confidenceBias: number;
  /** How much the agent hedges its statements (consumed by prompt builder). */
  readonly hedgingLevel: number;
  readonly topicCalibration: Readonly<Record<TopicId, TopicCalibration>>;
  readonly updatedAt: string;
  /** Which EvolutionEvent produced this version (null only for v0). */
  readonly sourceEvolutionEventId: string | null;
}

/** Hard bounds. Reflection may propose anything; EvolutionEngine clamps. */
export const PARAM_BOUNDS = {
  confidenceBias: { min: -0.3, max: 0.3 },
  hedgingLevel: { min: 0, max: 1 },
  topicMultiplier: { min: 0.5, max: 1.5 },
  /** Effective confidence is always clamped into a sane probability range. */
  effectiveConfidence: { min: 0.01, max: 0.99 },
} as const;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function defaultParams(agentId: string, nowIso: string): AgentParams {
  return {
    agentId,
    version: 0,
    confidenceBias: 0,
    hedgingLevel: 0.3,
    topicCalibration: {},
    updatedAt: nowIso,
    sourceEvolutionEventId: null,
  };
}

/**
 * Inference-side helper: converts the model's raw confidence into the
 * calibrated confidence the agent actually states. With default params this is
 * the identity function (bias 0, multiplier 1.0) — safe to ship behind a flag.
 */
export function applyCalibration(
  params: AgentParams,
  topic: TopicId,
  rawConfidence: number,
): number {
  const multiplier = params.topicCalibration[topic]?.multiplier ?? 1.0;
  const calibrated = rawConfidence * multiplier + params.confidenceBias;
  return clamp(
    calibrated,
    PARAM_BOUNDS.effectiveConfidence.min,
    PARAM_BOUNDS.effectiveConfidence.max,
  );
}

/**
 * Machine-readable change to AgentParams. Discriminated union → exhaustive
 * handling in EvolutionEngine is compiler-enforced.
 */
export type ParamDelta =
  | {
      readonly kind: 'confidenceBias';
      readonly from: number;
      readonly to: number;
    }
  | {
      readonly kind: 'hedgingLevel';
      readonly from: number;
      readonly to: number;
    }
  | {
      readonly kind: 'topicMultiplier';
      readonly topic: TopicId;
      readonly from: number;
      readonly to: number;
      readonly sampleSize: number;
    };

export function deltaMagnitude(delta: ParamDelta): number {
  return Math.abs(delta.to - delta.from);
}
