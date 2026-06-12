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
 * Composite collection cursor (FIX 2.2): `resolvedAt` alone is NOT unique —
 * one final whistle resolves a batch of predictions with an identical
 * timestamp. Paginating with `resolvedAt > watermark` silently drops the tail
 * of such a group at a page boundary. The cursor is strictly ordered by
 * (resolvedAt, eventId) instead.
 */
export interface ResolvedCursor {
  readonly resolvedAt: string;
  readonly eventId: string;
}

/** Strict ordering predicate for (resolvedAt, eventId). */
export function isAfterCursor(event: PredictionEvent, after: ResolvedCursor | null): boolean {
  if (event.outcome === null) return false;
  if (after === null) return true;
  if (event.outcome.resolvedAt !== after.resolvedAt) {
    return event.outcome.resolvedAt > after.resolvedAt;
  }
  return event.id > after.eventId;
}

export function compareByCursor(a: PredictionEvent, b: PredictionEvent): number {
  const ra = a.outcome?.resolvedAt ?? '';
  const rb = b.outcome?.resolvedAt ?? '';
  if (ra !== rb) return ra < rb ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Read/append port over your existing AgentEventService.
 * IMPORTANT: reflection consumes events by `outcome.resolvedAt`, not by `ts` —
 * a prediction made before the last sleep may resolve after it and must not be
 * missed. The adapter needs a resolvedAt-ordered index (migration step 1).
 */
export interface AgentEventReader {
  /**
   * Resolved predictions strictly after the composite cursor (exclusive),
   * ordered by (resolvedAt, eventId) ascending. `after = null` → from start.
   */
  listResolvedSince(
    agentId: string,
    after: ResolvedCursor | null,
    limit: number,
  ): Promise<readonly PredictionEvent[]>;

  appendEvolutionEvent(event: EvolutionEvent): Promise<void>;

  /**
   * Idempotency + redo source (FIX 2.1): the duplicate-run branch must inspect
   * the recorded event to decide between "skip" and "re-apply intent that
   * never reached params". Returns null if this run has no event yet.
   */
  getEvolutionEventForRun(agentId: string, runId: string): Promise<EvolutionEvent | null>;
}
