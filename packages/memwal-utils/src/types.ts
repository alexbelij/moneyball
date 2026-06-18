/**
 * @module types
 * Shared type definitions for memwal-utils.
 *
 * These types decouple the utilities from the MemWal SDK so you can use
 * `MemWalWriteQueue` or `KvOverlay` with any compatible remember/recall
 * implementation — including test doubles.
 *
 * @packageDocumentation
 */

/* ── Remember function ────────────────────────────────────────────── */

/**
 * A function that durably stores a text memory in MemWal.
 *
 * Typically wraps `memwal.remember(text)` and, if the SDK returns a
 * `job_id`, awaits `memwal.waitForRememberJob(job_id)` before resolving.
 *
 * @param text - The text payload to persist (may include structured
 *   prefixes for later recall filtering).
 * @throws On network errors, 429 rate limits, or SEAL session expiry.
 *
 * @example
 * ```ts
 * const remember: RememberFn = async (text) => {
 *   const job = await memwal.remember(text);
 *   if (job?.job_id) await memwal.waitForRememberJob(job.job_id);
 * };
 * ```
 */
export type RememberFn = (text: string) => Promise<void>;

/* ── Recall function ──────────────────────────────────────────────── */

/**
 * A single result item returned by a MemWal recall query.
 * The SDK may use `text` or `content` depending on version.
 */
export interface RecallResultItem {
  text?: string;
  content?: string;
}

/**
 * A function that performs semantic search over stored memories.
 *
 * Typically wraps `memwal.recall(query)`.
 *
 * @param query - Natural-language or prefix-anchored search string.
 * @returns An object with a `results` array of matching items.
 *
 * @example
 * ```ts
 * const recall: RecallFn = async (query) => {
 *   return memwal.recall(query);
 * };
 * ```
 */
export type RecallFn = (query: string) => Promise<{ results: RecallResultItem[] }>;

/* ── Write queue options ──────────────────────────────────────────── */

/**
 * Configuration for {@link MemWalWriteQueue}.
 *
 * Both values were determined through production testing against the
 * MemWal relayer (rate limits are undocumented as of SDK v0.0.7).
 */
export interface WriteQueueOptions {
  /**
   * Milliseconds to wait after an `enqueue()` call before actually writing.
   * If the same key is enqueued again within this window, the earlier value
   * is replaced (coalesced). Prevents redundant writes during rapid updates.
   *
   * @defaultValue 1500
   */
  debounceMs: number;

  /**
   * Minimum milliseconds between consecutive `remember()` calls.
   * Keeps the request rate under the relayer's undocumented limit.
   *
   * @defaultValue 1200
   */
  minIntervalMs: number;
}

/* ── KV overlay types ─────────────────────────────────────────────── */

/**
 * Write priority for the KV overlay.
 *
 * - `HIGH`     — must never be dropped or coalesced (locks, params, checkpoints).
 * - `NORMAL`   — may be coalesced if the same key is written again before flush.
 * - `LOW_LOSSY`— may be dropped entirely under sustained backpressure.
 */
export type WritePriority = 'HIGH' | 'NORMAL' | 'LOW_LOSSY';

/**
 * A stored value with its opaque storage-level version tag.
 * Used for optimistic concurrency (compare-and-swap) on subsequent writes.
 */
export interface VersionedRecord<T> {
  readonly value: T;
  /**
   * Opaque version tag from the storage layer (e.g. a sequence number or
   * etag). This is NOT your application-level version — it tracks the
   * storage revision for CAS guards.
   */
  readonly version: string;
}

/**
 * Outcome of a KV write attempt.
 */
export type WriteResult =
  | { readonly ok: true; readonly version: string }
  | { readonly ok: false; readonly reason: 'version_conflict' | 'dropped' };

/**
 * Options for a KV write operation.
 */
export interface KvWriteOptions {
  /** Write priority (affects coalescing and drop behaviour). */
  readonly priority: WritePriority;

  /**
   * CAS precondition:
   *   - `string`    — write only if the current version matches.
   *   - `null`      — write only if the key does not exist yet.
   *   - `undefined` — unconditional write (no CAS check).
   */
  readonly ifVersion?: string | null;

  /**
   * - `true`  — resolve only after the write is durable in MemWal
   *             (required for locks, params, checkpoints).
   * - `false` — resolve after enqueue into the write queue (fire-and-forget).
   */
  readonly awaitDurability: boolean;
}
