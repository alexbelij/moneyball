/**
 * # @moneyball/memwal-utils
 *
 * Production-tested utilities for building applications on MemWal SDK:
 *
 * - **{@link MemWalWriteQueue}** — Rate-limited, coalescing write queue
 *   that handles 429 backoff and key deduplication.
 *
 * - **{@link KvOverlay}** — Key-value semantics (get/put with CAS) over
 *   MemWal's append-only semantic store.
 *
 * - **{@link createKeyBuilder}** — Type-safe key construction with
 *   namespace prefixes to prevent typo-driven recall failures.
 *
 * Born from the [Moneyball](https://github.com/anna-stolbovskaja/moneyball)
 * World Cup prediction project — five AI agents with self-learning loops,
 * all state persisted on Walrus mainnet through MemWal.
 *
 * @packageDocumentation
 */

/* ── Write queue ──────────────────────────────────────────────────── */

export { MemWalWriteQueue } from './writeQueue.js';

/* ── KV overlay ───────────────────────────────────────────────────── */

export {
  KvOverlay,
  KvVersionConflictError,
  type KvOverlayOptions,
  type KvEntry,
  type KvPutOptions,
} from './kvOverlay.js';

/* ── Key builder ──────────────────────────────────────────────────── */

export { createKeyBuilder, MoneyballKeys } from './keyBuilder.js';

/* ── Shared types ─────────────────────────────────────────────────── */

export type {
  RememberFn,
  RecallFn,
  RecallResultItem,
  WriteQueueOptions,
  WritePriority,
  VersionedRecord,
  WriteResult,
  KvWriteOptions,
} from './types.js';
