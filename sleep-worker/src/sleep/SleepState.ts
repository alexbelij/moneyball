import type { TopicId } from '../params/AgentParams.js';
import type { ResolvedCursor } from '../events/types.js';

/**
 * Per-agent sleep bookkeeping. Three records, ONE writer each (FIX 1.1 —
 * the old design had interaction path + sleep pipeline doing non-CAS RMW on
 * the same sleep_state doc, which allowed watermark regression and double
 * learning):
 *   - SleepState      key: agent/{id}/sys/sleep_state
 *       watermark/cooldowns — written ONLY by the sleep pipeline (CAS).
 *   - ResolvedCounter key: agent/{id}/sys/resolved_counter
 *       monotonic counter — written ONLY by the interaction path (CAS-retry,
 *       lossy under extreme contention by design; never reset).
 *   - SleepCheckpoint key: agent/{id}/sys/sleep_checkpoint
 *       written only by the sleep pipeline; enables crash-resume.
 */

export interface SleepState {
  readonly agentId: string;
  readonly lastSleepAt: string | null;
  /**
   * Reflection watermark: composite (resolvedAt, eventId) cursor of the last
   * processed event (FIX 2.2 — resolvedAt alone is not unique: one final
   * whistle resolves many predictions with an identical timestamp, and an
   * exclusive `>` comparison loses the tail of the group at a page boundary).
   */
  readonly resolvedWatermark: ResolvedCursor | null;
  /**
   * Derived, not persisted: counter.value - counterAtLastSleep.
   * Trigger counter for "is sleep due".
   */
  readonly resolvedSinceSleep: number;
  /** Value of the monotonic resolved counter at the last COMMIT. */
  readonly counterAtLastSleep: number;
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
    counterAtLastSleep: 0,
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
