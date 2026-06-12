import { MemWalKeys } from '../memory/keys.js';
import type { Clock, MemWalClient } from '../memory/MemWalClient.js';
import type { TopicId } from '../params/AgentParams.js';
import type { ResolvedCursor } from '../events/types.js';
import { initialSleepState, type SleepCheckpoint, type SleepState } from './SleepState.js';

/**
 * Persistence for SleepState + ResolvedCounter + SleepCheckpoint.
 *
 * Writer separation (FIX 1.1):
 *   - sleep_state       — written ONLY by the sleep pipeline (commitSleep /
 *                         recordAbort), always under SleepLock, always CAS.
 *   - resolved_counter  — written ONLY by the outcome-resolution path,
 *                         CAS-retry (≤3 attempts) then drop: losing an
 *                         increment only delays a sleep, never corrupts it
 *                         (COLLECT re-derives truth from the resolvedAt cursor).
 *
 * The counter is MONOTONIC and never reset — commitSleep records the counter
 * value at COMMIT time (`counterAtLastSleep`), and `resolvedSinceSleep` is
 * derived as `counter - counterAtLastSleep`. A reset-based design would
 * reintroduce the two-writers-one-key race this fix removes.
 */

interface ResolvedCounterDoc {
  readonly n: number;
}

/** Persisted shape: resolvedSinceSleep is derived, not stored. */
type PersistedSleepState = Omit<SleepState, 'resolvedSinceSleep'>;

const CAS_ATTEMPTS = 3;

export class SleepStateStore {
  constructor(
    private readonly memwal: MemWalClient,
    private readonly clock: Clock,
  ) {}

  async get(agentId: string): Promise<SleepState> {
    const [stateRec, counter] = await Promise.all([
      this.memwal.read<PersistedSleepState>(MemWalKeys.sleepState(agentId)),
      this.readCounter(agentId),
    ]);
    const persisted: PersistedSleepState = stateRec?.value ?? initialSleepState(agentId);
    return {
      ...persisted,
      resolvedSinceSleep: Math.max(0, counter - persisted.counterAtLastSleep),
    };
  }

  /**
   * Called by the outcome-resolution path. Touches ONLY resolved_counter.
   * CAS-retry then drop — lossy by design under extreme contention.
   */
  async recordOutcomeResolved(agentId: string): Promise<void> {
    const key = MemWalKeys.resolvedCounter(agentId);
    for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt++) {
      const rec = await this.memwal.read<ResolvedCounterDoc>(key);
      const result = await this.memwal.write<ResolvedCounterDoc>(
        key,
        { n: (rec?.value.n ?? 0) + 1 },
        {
          priority: 'NORMAL',
          ifVersion: rec?.memwalVersion ?? null,
          awaitDurability: false,
        },
      );
      if (result.ok) return;
    }
    // Dropped increment: acceptable — it only delays the sleep trigger.
  }

  /**
   * COMMIT at the end of a successful sleep run. Sole writer of sleep_state
   * (under SleepLock); CAS-retry as defense in depth against zombie holders.
   */
  async commitSleep(
    agentId: string,
    update: {
      readonly resolvedWatermark: ResolvedCursor | null;
      readonly adjustedTopics: readonly TopicId[];
      readonly topicCooldownSleeps: number;
      readonly paramsVersion: number;
      /**
       * Events actually processed this run. The counter baseline advances by
       * this amount (capped by the live counter) — if COLLECT cut a page
       * (e.g. identical-resolvedAt tail), the unprocessed remainder keeps the
       * sleep trigger armed instead of being silently absorbed.
       */
      readonly processedCount: number;
    },
  ): Promise<void> {
    await this.casUpdateState(agentId, (state, counter) => {
      // Decrement existing cooldowns, then arm new ones for adjusted topics.
      const cooldowns: Record<TopicId, number> = {};
      for (const [topic, remaining] of Object.entries(state.topicCooldowns)) {
        if (remaining > 1) cooldowns[topic] = remaining - 1;
      }
      for (const topic of update.adjustedTopics) {
        cooldowns[topic] = update.topicCooldownSleeps;
      }
      return {
        ...state,
        lastSleepAt: this.clock.nowIso(),
        resolvedWatermark: update.resolvedWatermark ?? state.resolvedWatermark,
        counterAtLastSleep: Math.min(counter, state.counterAtLastSleep + update.processedCount),
        topicCooldowns: cooldowns,
        consecutiveAborts: 0,
        paramsVersionAtLastSleep: update.paramsVersion,
      };
    });
  }

  async recordAbort(agentId: string): Promise<void> {
    await this.casUpdateState(agentId, (state) => ({
      ...state,
      consecutiveAborts: state.consecutiveAborts + 1,
    }));
  }

  /** CAS read-modify-write loop for sleep_state (sleep pipeline only). */
  private async casUpdateState(
    agentId: string,
    mutate: (state: PersistedSleepState, counter: number) => PersistedSleepState,
  ): Promise<void> {
    const key = MemWalKeys.sleepState(agentId);
    for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt++) {
      const [rec, counter] = await Promise.all([
        this.memwal.read<PersistedSleepState>(key),
        this.readCounter(agentId),
      ]);
      const current: PersistedSleepState = rec?.value ?? initialSleepState(agentId);
      const result = await this.memwal.write(key, mutate(current, counter), {
        priority: 'HIGH',
        ifVersion: rec?.memwalVersion ?? null,
        awaitDurability: true,
      });
      if (result.ok) return;
    }
    throw new Error(`sleep_state CAS exhausted for agent ${agentId} (${CAS_ATTEMPTS} attempts)`);
  }

  private async readCounter(agentId: string): Promise<number> {
    const rec = await this.memwal.read<ResolvedCounterDoc>(MemWalKeys.resolvedCounter(agentId));
    return rec?.value.n ?? 0;
  }

  // --- Checkpoints -----------------------------------------------------------

  async getCheckpoint(agentId: string): Promise<SleepCheckpoint | null> {
    const record = await this.memwal.read<SleepCheckpoint>(
      MemWalKeys.sleepCheckpoint(agentId),
    );
    return record?.value ?? null;
  }

  async saveCheckpoint(checkpoint: SleepCheckpoint): Promise<void> {
    await this.memwal.write(MemWalKeys.sleepCheckpoint(checkpoint.agentId), checkpoint, {
      priority: 'HIGH',
      awaitDurability: true,
    });
  }

  async clearCheckpoint(agentId: string): Promise<void> {
    await this.memwal.delete(MemWalKeys.sleepCheckpoint(agentId), {
      priority: 'HIGH',
      awaitDurability: true,
    });
  }
}
