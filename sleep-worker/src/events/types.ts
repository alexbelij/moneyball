import type { ParamDelta, TopicId } from '../params/AgentParams.js';
import type { ReflectionMetrics } from '../reflection/metrics.js';

/**
 * Target shape of PredictionEvent after migration (step 1 of migration path).
 * New fields vs current AgentEventService event:
 *   - paramsVersion        (backfill 0 for historical events)
 *   - rawConfidence        (what the model said before calibration)
 *   - effectiveConfidence  (what the agent actually stated; backfill = stored confidence)
 */
export interface PredictionEvent {
  readonly id: string;
  readonly agentId: string;
  readonly userId: string;
  readonly topic: TopicId;
  readonly prediction: string;
  readonly rawConfidence: number;
  readonly effectiveConfidence: number;
  /** AgentParams.version active when the prediction was made. */
  readonly paramsVersion: number;
  readonly outcome: PredictionOutcome | null;
  readonly disagree: DisagreeMark | null;
  readonly ts: string;
}

export interface PredictionOutcome {
  readonly correct: boolean;
  /** When the outcome became known — drives the reflection watermark. */
  readonly resolvedAt: string;
}

export interface DisagreeMark {
  readonly userId: string;
  readonly ts: string;
}

export type EvolutionEventType = 'param_update' | 'rollback' | 'noop';

export interface EvolutionEvent {
  readonly id: string;
  readonly agentId: string;
  /** Sleep run that produced this event; id is derived from runId → idempotent. */
  readonly runId: string;
  readonly type: EvolutionEventType;
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly deltas: readonly ParamDelta[];
  /** Human-readable explanation, rendered deterministically from metrics. */
  readonly diagnosis: string;
  readonly evidence: {
    readonly eventIds: readonly string[];
    readonly metrics: ReflectionMetrics;
  };
  /** Was this evolution applied in dry-run (shadow) mode without touching params. */
  readonly dryRun: boolean;
  readonly ts: string;
}

/**
 * Read/append port over your existing AgentEventService.
 * IMPORTANT: reflection consumes events by `outcome.resolvedAt`, not by `ts` —
 * a prediction made before the last sleep may resolve after it and must not be
 * missed. The adapter needs a resolvedAt-ordered index (migration step 1).
 */
export interface AgentEventReader {
  /**
   * Resolved predictions with outcome.resolvedAt > sinceResolvedAt (exclusive),
   * ordered by resolvedAt ascending. `sinceResolvedAt = null` → from the start.
   */
  listResolvedSince(
    agentId: string,
    sinceResolvedAt: string | null,
    limit: number,
  ): Promise<readonly PredictionEvent[]>;

  appendEvolutionEvent(event: EvolutionEvent): Promise<void>;

  /** Idempotency guard: has this sleep run already emitted its event. */
  hasEvolutionEventForRun(agentId: string, runId: string): Promise<boolean>;
}
