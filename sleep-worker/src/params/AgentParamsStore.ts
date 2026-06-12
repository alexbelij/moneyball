import { MemWalKeys } from '../memory/keys.js';
import type { Clock, MemWalClient } from '../memory/MemWalClient.js';
import {
  PARAM_BOUNDS,
  defaultParams,
  type AgentParams,
  type ParamDelta,
} from './AgentParams.js';

/**
 * Versioned store for AgentParams on MemWal.
 *
 * Concurrency model:
 *   - Writers: exactly one — the sleep pipeline (guarded by SleepLock).
 *     All writes still use memwalVersion CAS as defense in depth.
 *   - Readers: inference path, via getCached() with a 30s TTL cache —
 *     the same pattern as MemWalUserSummaryStore.
 *
 * History: last `historyLimit` versions are kept under personality_history/{v},
 * so rollback is a pointer switch, not a recomputation.
 */

export interface AgentParamsStoreConfig {
  readonly cacheTtlMs: number;
  readonly historyLimit: number;
}

export const DEFAULT_PARAMS_STORE_CONFIG: AgentParamsStoreConfig = {
  cacheTtlMs: 30_000,
  historyLimit: 10,
};

interface CacheEntry {
  readonly params: AgentParams;
  readonly expiresAtMs: number;
}

export class ConcurrentParamsWriteError extends Error {
  constructor(agentId: string) {
    super(`Concurrent params write detected for agent ${agentId}`);
    this.name = 'ConcurrentParamsWriteError';
  }
}

export class AgentParamsStore {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly memwal: MemWalClient,
    private readonly clock: Clock,
    private readonly cfg: AgentParamsStoreConfig = DEFAULT_PARAMS_STORE_CONFIG,
  ) {}

  /** Inference path. Cached; stale params for ≤30s are acceptable by design. */
  async getCached(agentId: string): Promise<AgentParams> {
    const hit = this.cache.get(agentId);
    if (hit && hit.expiresAtMs > this.clock.nowMs()) return hit.params;
    const params = await this.getOrCreate(agentId);
    this.cache.set(agentId, {
      params,
      expiresAtMs: this.clock.nowMs() + this.cfg.cacheTtlMs,
    });
    return params;
  }

  /** Sleep pipeline path. Always fresh — never use the cache for evolution. */
  async getOrCreate(agentId: string): Promise<AgentParams> {
    const record = await this.memwal.read<AgentParams>(MemWalKeys.personality(agentId));
    if (record !== null) return record.value;

    const fresh = defaultParams(agentId, this.clock.nowIso());
    const result = await this.memwal.write(MemWalKeys.personality(agentId), fresh, {
      priority: 'HIGH',
      ifVersion: null, // create only if absent — lost race ⇒ re-read
      awaitDurability: true,
    });
    if (!result.ok) {
      const raced = await this.memwal.read<AgentParams>(MemWalKeys.personality(agentId));
      if (raced === null) throw new ConcurrentParamsWriteError(agentId);
      return raced.value;
    }
    // FIX 3.1: snapshot genesis into history. Without it the very first
    // rollback (v1 → v0) throws "no snapshot" → eternal abort loop, exactly
    // when params are bad and rollback is most needed (history-before-pointer
    // invariant must hold for v0 too).
    await this.memwal.write(MemWalKeys.personalityHistory(agentId, 0), fresh, {
      priority: 'HIGH',
      awaitDurability: true,
    });
    return fresh;
  }

  /**
   * Applies validated deltas as version N+1. CAS on both the params doc
   * (memwalVersion) and the logical version (expectedVersion).
   */
  async commitNewVersion(
    agentId: string,
    expectedVersion: number,
    deltas: readonly ParamDelta[],
    sourceEvolutionEventId: string,
  ): Promise<AgentParams> {
    const key = MemWalKeys.personality(agentId);
    const record = await this.memwal.read<AgentParams>(key);
    if (record === null || record.value.version !== expectedVersion) {
      throw new ConcurrentParamsWriteError(agentId);
    }

    const next = this.materialize(record.value, deltas, sourceEvolutionEventId);

    // 1) Snapshot the new version into history first (history before pointer:
    //    a crash between the two writes must never lose a referenced version).
    await this.memwal.write(MemWalKeys.personalityHistory(agentId, next.version), next, {
      priority: 'HIGH',
      awaitDurability: true,
    });

    // 2) Switch the live pointer with CAS.
    const result = await this.memwal.write(key, next, {
      priority: 'HIGH',
      ifVersion: record.memwalVersion,
      awaitDurability: true,
    });
    if (!result.ok) throw new ConcurrentParamsWriteError(agentId);

    this.cache.delete(agentId);
    await this.pruneHistory(agentId, next.version);
    return next;
  }

  /** Rollback = re-commit a historical snapshot as version N+1 (audit-friendly). */
  async rollbackTo(
    agentId: string,
    targetVersion: number,
    expectedVersion: number,
    sourceEvolutionEventId: string,
  ): Promise<AgentParams> {
    const snapshot = await this.memwal.read<AgentParams>(
      MemWalKeys.personalityHistory(agentId, targetVersion),
    );
    const key = MemWalKeys.personality(agentId);
    const record = await this.memwal.read<AgentParams>(key);
    if (record === null || record.value.version !== expectedVersion) {
      throw new ConcurrentParamsWriteError(agentId);
    }

    // FIX 3.1 fallback: v0 is fully deterministic — reconstruct it even if the
    // genesis snapshot is missing (agents created before this fix).
    const base: AgentParams | null =
      snapshot?.value ??
      (targetVersion === 0 ? defaultParams(agentId, this.clock.nowIso()) : null);
    if (base === null) {
      throw new Error(`No history snapshot v${targetVersion} for agent ${agentId}`);
    }

    const next: AgentParams = {
      ...base,
      version: expectedVersion + 1, // history moves forward, never rewinds
      updatedAt: this.clock.nowIso(),
      sourceEvolutionEventId,
    };

    await this.memwal.write(MemWalKeys.personalityHistory(agentId, next.version), next, {
      priority: 'HIGH',
      awaitDurability: true,
    });
    const result = await this.memwal.write(key, next, {
      priority: 'HIGH',
      ifVersion: record.memwalVersion,
      awaitDurability: true,
    });
    if (!result.ok) throw new ConcurrentParamsWriteError(agentId);

    this.cache.delete(agentId);
    return next;
  }

  private materialize(
    current: AgentParams,
    deltas: readonly ParamDelta[],
    sourceEvolutionEventId: string,
  ): AgentParams {
    let confidenceBias = current.confidenceBias;
    let hedgingLevel = current.hedgingLevel;
    const topicCalibration = { ...current.topicCalibration };

    for (const delta of deltas) {
      switch (delta.kind) {
        case 'confidenceBias':
          confidenceBias = delta.to;
          break;
        case 'hedgingLevel':
          hedgingLevel = delta.to;
          break;
        case 'topicMultiplier':
          topicCalibration[delta.topic] = {
            multiplier: delta.to,
            sampleSize: delta.sampleSize,
          };
          break;
      }
    }

    this.assertBounds(confidenceBias, hedgingLevel, topicCalibration);

    return {
      ...current,
      version: current.version + 1,
      confidenceBias,
      hedgingLevel,
      topicCalibration,
      updatedAt: this.clock.nowIso(),
      sourceEvolutionEventId,
    };
  }

  /** Hard invariant — violated bounds mean a bug upstream. Fail loudly. */
  private assertBounds(
    confidenceBias: number,
    hedgingLevel: number,
    topicCalibration: Readonly<Record<string, { multiplier: number }>>,
  ): void {
    const inRange = (x: number, b: { min: number; max: number }): boolean =>
      x >= b.min && x <= b.max;
    if (!inRange(confidenceBias, PARAM_BOUNDS.confidenceBias)) {
      throw new RangeError(`confidenceBias out of bounds: ${confidenceBias}`);
    }
    if (!inRange(hedgingLevel, PARAM_BOUNDS.hedgingLevel)) {
      throw new RangeError(`hedgingLevel out of bounds: ${hedgingLevel}`);
    }
    for (const [topic, cal] of Object.entries(topicCalibration)) {
      if (!inRange(cal.multiplier, PARAM_BOUNDS.topicMultiplier)) {
        throw new RangeError(`topicMultiplier out of bounds for ${topic}: ${cal.multiplier}`);
      }
    }
  }

  private async pruneHistory(agentId: string, latestVersion: number): Promise<void> {
    const evictBelow = latestVersion - this.cfg.historyLimit;
    if (evictBelow <= 0) return;
    const keys = await this.memwal.listKeys(MemWalKeys.personalityHistoryPrefix(agentId));
    for (const key of keys) {
      const version = Number(key.slice(key.lastIndexOf('/') + 1));
      if (Number.isFinite(version) && version < evictBelow) {
        await this.memwal.delete(key, { priority: 'NORMAL', awaitDurability: false });
      }
    }
  }
}
