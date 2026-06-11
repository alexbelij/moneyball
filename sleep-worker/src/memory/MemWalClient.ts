/**
 * Port interface over MemWal. The adapter is implemented once, wrapping your
 * existing MemWal access layer + MemWalWriteQueue (see migration path, step 2).
 *
 * Design decisions:
 *  - Reads are direct (queue is write-only); caching is the caller's concern
 *    (AgentParamsStore reuses the 30s-cache pattern from MemWalUserSummaryStore).
 *  - Writes carry a priority so the queue can shed load correctly under 429:
 *    HIGH must never be dropped/coalesced-away (personality, evolution, locks),
 *    NORMAL may be coalesced, LOW_LOSSY may be dropped under backpressure.
 *  - `ifVersion` gives optimistic concurrency (CAS). If MemWal cannot do CAS
 *    natively, the adapter emulates it via read-verify-write — safe because the
 *    sleep pipeline guarantees a single writer per agent (lock + sharding).
 */

export type WritePriority = 'HIGH' | 'NORMAL' | 'LOW_LOSSY';

export interface VersionedRecord<T> {
  readonly value: T;
  /** Opaque storage-level version tag (etag/seq). NOT AgentParams.version. */
  readonly memwalVersion: string;
}

export type WriteResult =
  | { readonly ok: true; readonly memwalVersion: string }
  | { readonly ok: false; readonly reason: 'version_conflict' | 'dropped' };

export interface WriteOptions {
  readonly priority: WritePriority;
  /**
   * CAS precondition:
   *   string  — write only if current memwalVersion matches;
   *   null    — write only if the key does not exist yet;
   *   undefined — unconditional write.
   */
  readonly ifVersion?: string | null;
  /**
   * true  — resolve only after the write is durable in MemWal (required for
   *         locks, params, checkpoints);
   * false — resolve after enqueue into MemWalWriteQueue (fire-and-forget).
   */
  readonly awaitDurability: boolean;
}

export interface MemWalClient {
  read<T>(key: string): Promise<VersionedRecord<T> | null>;
  write<T>(key: string, value: T, opts: WriteOptions): Promise<WriteResult>;
  delete(key: string, opts: Pick<WriteOptions, 'priority' | 'awaitDurability'>): Promise<void>;
  listKeys(prefix: string, opts?: { readonly limit?: number }): Promise<readonly string[]>;
}

/** Injected clock — deterministic tests, no Date.now() scattered around. */
export interface Clock {
  nowIso(): string;
  nowMs(): number;
}

export const systemClock: Clock = {
  nowIso: () => new Date().toISOString(),
  nowMs: () => Date.now(),
};
