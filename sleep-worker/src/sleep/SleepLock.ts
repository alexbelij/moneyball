import { MemWalKeys } from '../memory/keys.js';
import type { Clock, MemWalClient } from '../memory/MemWalClient.js';
import type { SleepLockRecord } from './SleepState.js';

/**
 * Distributed lock on MemWal: CAS write of a lock record with TTL.
 * Guarantees at most one sleep run per agent across all workers.
 * A crashed holder's lock expires by TTL — no manual cleanup.
 *
 * NOTE: if MemWal cannot do native CAS, this still works when sleep jobs are
 * partitioned by agentId onto a single consumer (see migration path, step 2).
 */

export interface SleepLockHandle {
  readonly runId: string;
  release(): Promise<void>;
}

export class SleepLock {
  constructor(
    private readonly memwal: MemWalClient,
    private readonly clock: Clock,
    private readonly ttlMs: number = 10 * 60_000,
  ) {}

  /** Returns null if another live run holds the lock. */
  async tryAcquire(agentId: string, runId: string): Promise<SleepLockHandle | null> {
    const key = MemWalKeys.sleepLock(agentId);
    const existing = await this.memwal.read<SleepLockRecord>(key);

    const record: SleepLockRecord = {
      runId,
      acquiredAt: this.clock.nowIso(),
      expiresAtMs: this.clock.nowMs() + this.ttlMs,
    };

    if (existing === null) {
      const result = await this.memwal.write(key, record, {
        priority: 'HIGH',
        ifVersion: null,
        awaitDurability: true,
      });
      return result.ok ? this.handle(agentId, runId) : null;
    }

    if (existing.value.expiresAtMs > this.clock.nowMs()) {
      return null; // live holder
    }

    // Expired lock — steal with CAS so only one stealer wins.
    const result = await this.memwal.write(key, record, {
      priority: 'HIGH',
      ifVersion: existing.memwalVersion,
      awaitDurability: true,
    });
    return result.ok ? this.handle(agentId, runId) : null;
  }

  private handle(agentId: string, runId: string): SleepLockHandle {
    return {
      runId,
      release: async (): Promise<void> => {
        // Release only our own lock: re-check runId before deleting.
        const key = MemWalKeys.sleepLock(agentId);
        const current = await this.memwal.read<SleepLockRecord>(key);
        if (current !== null && current.value.runId === runId) {
          await this.memwal.delete(key, { priority: 'HIGH', awaitDurability: true });
        }
      },
    };
  }
}
