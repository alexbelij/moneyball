import { MemWalKeys } from '../memory/keys.js';
import type { Clock, MemWalClient } from '../memory/MemWalClient.js';
import type { TopicId } from '../params/AgentParams.js';
import { initialSleepState, type SleepCheckpoint, type SleepState } from './SleepState.js';

/**
 * Persistence for SleepState + SleepCheckpoint.
 *
 * Counter increments (interaction path) go through MemWalWriteQueue with
 * NORMAL priority and coalescing — the queue's debounce already batches the
 * hot path. Losing a few increments under extreme backpressure only delays a
 * sleep; it never corrupts it (COLLECT re-derives truth from resolvedAt).
 */
export class SleepStateStore {
  constructor(
    private readonly memwal: MemWalClient,
    private readonly clock: Clock,
  ) {}

  async get(agentId: string): Promise<SleepState> {
    const record = await this.memwal.read<SleepState>(MemWalKeys.sleepState(agentId));
    return record?.value ?? initialSleepState(agentId);
  }

  /** Called by the outcome-resolution path. Cheap, coalesced, lossy-tolerant. */
  async recordOutcomeResolved(agentId: string): Promise<void> {
    const state = await this.get(agentId);
    await this.memwal.write(
      MemWalKeys.sleepState(agentId),
      { ...state, resolvedSinceSleep: state.resolvedSinceSleep + 1 },
      { priority: 'NORMAL', awaitDurability: false },
    );
  }

  /** Atomic COMMIT at the end of a successful sleep run. */
  async commitSleep(
    agentId: string,
    update: {
      readonly resolvedWatermark: string | null;
      readonly adjustedTopics: readonly TopicId[];
      readonly topicCooldownSleeps: number;
      readonly paramsVersion: number;
    },
  ): Promise<void> {
    const state = await this.get(agentId);

    // Decrement existing cooldowns, then arm new ones for adjusted topics.
    const cooldowns: Record<TopicId, number> = {};
    for (const [topic, remaining] of Object.entries(state.topicCooldowns)) {
      if (remaining > 1) cooldowns[topic] = remaining - 1;
    }
    for (const topic of update.adjustedTopics) {
      cooldowns[topic] = update.topicCooldownSleeps;
    }

    const next: SleepState = {
      ...state,
      lastSleepAt: this.clock.nowIso(),
      resolvedWatermark: update.resolvedWatermark ?? state.resolvedWatermark,
      resolvedSinceSleep: 0,
      topicCooldowns: cooldowns,
      consecutiveAborts: 0,
      paramsVersionAtLastSleep: update.paramsVersion,
    };
    await this.memwal.write(MemWalKeys.sleepState(agentId), next, {
      priority: 'HIGH',
      awaitDurability: true,
    });
  }

  async recordAbort(agentId: string): Promise<void> {
    const state = await this.get(agentId);
    await this.memwal.write(
      MemWalKeys.sleepState(agentId),
      { ...state, consecutiveAborts: state.consecutiveAborts + 1 },
      { priority: 'HIGH', awaitDurability: true },
    );
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
