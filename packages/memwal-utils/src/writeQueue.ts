/**
 * @module writeQueue
 *
 * Rate-limited, coalescing write queue for MemWal's `remember()` API.
 *
 * ### Why this exists
 *
 * The MemWal relayer enforces undocumented rate limits (HTTP 429 with
 * `retry_after_seconds` in the response body). Calling `remember()` directly
 * from hot paths (agent predictions, user interactions, parameter updates)
 * quickly triggers throttling. `MemWalWriteQueue` solves this with three
 * mechanisms:
 *
 * 1. **Key-based coalescing** — if the same key is enqueued multiple times
 *    before the debounce window expires, only the latest value is written.
 * 2. **Minimum interval** — enforces a floor between consecutive `remember()`
 *    calls to stay under rate limits.
 * 3. **Exponential backoff with server hints** — on 429, reads
 *    `retry_after_seconds` from the error; for other errors, uses standard
 *    exponential backoff capped at 60 seconds.
 *
 * ### Production-tested values
 *
 * | Parameter       | Recommended | Notes |
 * |----------------|-------------|-------|
 * | `debounceMs`   | 1500        | Coalesces rapid writes to the same key |
 * | `minIntervalMs`| 1200        | Safe floor per `remember()` call |
 *
 * These were determined through production testing on Walrus mainnet
 * (MemWal SDK v0.0.7, relayer at `relayer.memory.walrus.xyz`).
 *
 * @example
 * ```ts
 * import { MemWal } from '@mysten-incubation/memwal';
 * import { MemWalWriteQueue } from '@moneyball/memwal-utils';
 *
 * const memwal = MemWal.create({ key, accountId, serverUrl, namespace });
 *
 * const queue = new MemWalWriteQueue(
 *   async (text) => {
 *     const job = await memwal.remember(text);
 *     if (job?.job_id) await memwal.waitForRememberJob(job.job_id);
 *   },
 *   { debounceMs: 1500, minIntervalMs: 1200 },
 * );
 *
 * // Non-blocking — returns immediately, writes are batched in background.
 * queue.enqueue('user:0x8a71', JSON.stringify(userSummary));
 * queue.enqueue('params:dr_morgan', JSON.stringify(agentParams));
 *
 * // Same key within debounce window? Previous value is replaced.
 * queue.enqueue('params:dr_morgan', JSON.stringify(updatedParams));
 * ```
 *
 * @packageDocumentation
 */

import type { RememberFn, WriteQueueOptions } from './types.js';

/* ── Internal types ───────────────────────────────────────────────── */

interface Pending {
  key: string;
  text: string;
  nextAtMs: number;
  attempts: number;
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Attempt to extract `retry_after_seconds` from a MemWal 429 error.
 *
 * The relayer returns errors with a `cause` property containing a JSON
 * string like `{"retry_after_seconds": 2}`. This function parses that
 * defensively — any unexpected shape returns `null`.
 *
 * @internal
 */
function parseRetryAfterSeconds(err: unknown): number | null {
  try {
    const raw =
      typeof (err as { cause?: unknown })?.cause === 'string'
        ? (err as { cause: string }).cause
        : null;
    if (!raw) return null;
    const obj = JSON.parse(raw) as { retry_after_seconds?: unknown };
    const s = Number(obj?.retry_after_seconds);
    return Number.isFinite(s) && s > 0 ? s : null;
  } catch {
    return null;
  }
}

/* ── Default configuration ────────────────────────────────────────── */

const DEFAULT_OPTIONS: WriteQueueOptions = {
  debounceMs: 1500,
  minIntervalMs: 1200,
};

/** Maximum backoff cap for exponential retry (60 seconds). */
const MAX_BACKOFF_MS = 60_000;

/* ── Queue implementation ─────────────────────────────────────────── */

/**
 * A non-blocking, coalescing write queue for MemWal's `remember()` API.
 *
 * Enqueued writes are deduplicated by key (latest value wins) and dispatched
 * with rate-limit-aware throttling. The queue runs a single background loop
 * that processes one write at a time, respecting `minIntervalMs` between
 * calls and backing off on errors.
 *
 * ### Thread safety
 *
 * The queue is designed for single-threaded Node.js runtimes. It is safe to
 * call `enqueue()` from any async context — the internal loop serialises
 * all `remember()` calls.
 *
 * ### Lifecycle
 *
 * The queue starts automatically on first `enqueue()` and stops when the
 * pending map is empty. There is no explicit `close()` — if you need
 * graceful shutdown, drain the queue by waiting for the pending count to
 * reach zero.
 *
 * @example
 * ```ts
 * const queue = new MemWalWriteQueue(rememberFn);
 * queue.enqueue('agent:predictions', payload);
 *
 * // Check pending count (e.g. for health checks):
 * console.log(`Pending writes: ${queue.pendingCount}`);
 * ```
 */
export class MemWalWriteQueue {
  private pendingByKey = new Map<string, Pending>();
  private running = false;
  private lastWriteAtMs = 0;
  private opts: WriteQueueOptions;

  /**
   * Create a new write queue.
   *
   * @param remember - The function that persists a text payload to MemWal.
   *   Typically wraps `memwal.remember()` + optional `waitForRememberJob()`.
   * @param opts - Throttling configuration. Uses production-tested defaults
   *   if omitted.
   */
  constructor(
    private remember: RememberFn,
    opts: Partial<WriteQueueOptions> = {},
  ) {
    this.opts = { ...DEFAULT_OPTIONS, ...opts };
  }

  /**
   * Number of writes currently waiting to be flushed.
   * Useful for health checks and graceful shutdown logic.
   */
  get pendingCount(): number {
    return this.pendingByKey.size;
  }

  /**
   * Schedule a write. Returns immediately — the actual `remember()` call
   * happens asynchronously in the background loop.
   *
   * If the same `key` is already pending, its value is replaced (coalesced).
   * The debounce timer resets so the latest value is always the one written.
   *
   * @param key  - Deduplication key (e.g. `"user:0x8a71"`, `"params:dr_morgan"`).
   * @param text - The text payload to pass to `remember()`.
   */
  enqueue(key: string, text: string): void {
    const now = Date.now();
    this.pendingByKey.set(key, {
      key,
      text,
      nextAtMs: now + this.opts.debounceMs,
      attempts: 0,
    });
    this.kick();
  }

  /* ── Internals ────────────────────────────────────────────────── */

  private kick(): void {
    if (this.running) return;
    this.running = true;
    void this.loop();
  }

  private pickNext(): Pending | null {
    let best: Pending | null = null;
    for (const p of this.pendingByKey.values()) {
      if (!best || p.nextAtMs < best.nextAtMs) best = p;
    }
    return best;
  }

  private async loop(): Promise<void> {
    try {
      while (this.pendingByKey.size > 0) {
        const next = this.pickNext();
        if (!next) break;

        // Wait for debounce window
        const waitMs = Math.max(0, next.nextAtMs - Date.now());
        if (waitMs > 0) await sleep(waitMs);

        // Enforce minimum interval between writes
        const sinceLast = Date.now() - this.lastWriteAtMs;
        if (sinceLast < this.opts.minIntervalMs) {
          await sleep(this.opts.minIntervalMs - sinceLast);
        }

        // Re-read: the value may have been coalesced while we waited
        const current = this.pendingByKey.get(next.key);
        if (!current) continue;

        try {
          await this.remember(current.text);
          this.lastWriteAtMs = Date.now();
          this.pendingByKey.delete(current.key);
        } catch (e: unknown) {
          const retryAfter = parseRetryAfterSeconds(e);
          const backoffMs =
            retryAfter != null
              ? retryAfter * 1000
              : Math.min(MAX_BACKOFF_MS, 1000 * Math.pow(2, current.attempts));

          current.attempts += 1;
          current.nextAtMs = Date.now() + backoffMs;
          this.pendingByKey.set(current.key, current);
        }
      }
    } finally {
      this.running = false;
      if (this.pendingByKey.size > 0) this.kick();
    }
  }
}
