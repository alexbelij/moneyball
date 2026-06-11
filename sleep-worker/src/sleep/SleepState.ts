import type { TopicId } from '../params/AgentParams.js';

/**
 * Per-agent sleep bookkeeping. Two records, two writers:
 *   - SleepState      key: agent/{id}/sys/sleep_state
 *       counters incremented by the interaction path (coalesced LOW writes),
 *       watermark/cooldowns committed by the sleep pipeline (HIGH writes).
 *   - SleepCheckpoint key: agent/{id}/sys/sleep_checkpoint
 *       written only by the sleep pipeline; enables crash-resume.
 */

export interface SleepState {
  readonly agentId: string;
  readonly lastSleepAt: string | null;
  /**
   * Reflection watermark: max outcome.resolvedAt processed so far.
   * COLLECT reads events with resolvedAt > watermark. Watermarking by
   * resolvedAt (not event ts) guarantees late-resolving predictions are seen.
   */
  readonly resolvedWatermark: string | null;
  /** Outcomes resolved since last sleep — the trigger counter. */
  readonly resolvedSinceSleep: number;
  /** topic → remaining cooldown sleeps; decremented on each COMMIT. */
  readonly topicCooldowns: Readonly<Record<TopicId, number>>;
  readonly consecutiveAborts: number;
  readonly paramsVersionAtLastSleep: number;
}

export function initialSleepState(agentId: string): SleepState {
  return {
    agentId,
    lastSleepAt: null,
    resolvedWatermark: null,
    resolvedSinceSleep: 0,
    topicCooldowns: {},
    consecutiveAborts: 0,
    paramsVersionAtLastSleep: 0,
  };
}

export type SleepPhase = 'COLLECT' | 'REFLECT' | 'EVOLVE' | 'COMMIT';

export interface SleepCheckpoint {
  readonly agentId: string;
  readonly runId: string;
  /** Last successfully COMPLETED phase. Resume starts from the next one. */
  readonly completedPhase: SleepPhase | null;
  readonly attempt: number;
  readonly startedAt: string;
}

export type SleepRunResult =
  | { readonly kind: 'not_due' }
  | { readonly kind: 'lock_busy' }
  | { readonly kind: 'noop'; readonly runId: string; readonly reason: string }
  | { readonly kind: 'evolved'; readonly runId: string; readonly fromVersion: number; readonly toVersion: number }
  | { readonly kind: 'rolled_back'; readonly runId: string; readonly toVersion: number }
  | { readonly kind: 'aborted'; readonly runId: string; readonly error: string };

export interface SleepLockRecord {
  readonly runId: string;
  readonly acquiredAt: string;
  readonly expiresAtMs: number;
}
