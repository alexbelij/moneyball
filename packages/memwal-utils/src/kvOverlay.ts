/**
 * @module kvOverlay
 *
 * Key-value overlay for MemWal's semantic (append-only) store.
 *
 * ### Problem
 *
 * MemWal is an append-only semantic memory store. It has `remember(text)` and
 * `recall(query)` — but no concept of "update key X to value Y" or
 * "read the latest value for key X." For agent parameters, locks, and
 * checkpoints you need exact-key semantics with compare-and-swap (CAS).
 *
 * ### Solution
 *
 * `KvOverlay` layers a key-value interface on top of MemWal by encoding keys
 * and sequence numbers into the text payload:
 *
 * ```
 * remember("kv:myapp key=params:agent_1 seq=5\n{...json...}")
 * ```
 *
 * On read, it recalls by key prefix and picks the entry with the highest `seq`.
 * This gives last-writer-wins semantics with CAS via sequence comparison.
 *
 * ### Limitations
 *
 * - **Semantic recall is fuzzy.** `recall("kv:myapp key=params:agent_1")` may
 *   return near-matches for similar keys. The overlay filters by exact key
 *   match after recall, but performance degrades with many similar keys.
 *   We filed [MystenLabs/MemWal#289](https://github.com/MystenLabs/MemWal/issues/289)
 *   requesting native exact-key recall.
 *
 * - **Single writer assumed.** The CAS guard (seq comparison) is safe when a
 *   single writer owns each key. With concurrent writers, the highest seq wins
 *   on read but intermediate values may be lost.
 *
 * @example
 * ```ts
 * import { KvOverlay } from '@moneyball/memwal-utils';
 *
 * const kv = new KvOverlay(rememberFn, recallFn, {
 *   prefix: 'kv:myapp',
 * });
 *
 * // Write with sequence number
 * await kv.put('params:agent_1', { bias: 0.3, aggression: 0.7 }, { seq: 1 });
 *
 * // Read — returns the highest-seq entry for this key
 * const result = await kv.get<AgentParams>('params:agent_1');
 * if (result) {
 *   console.log(result.value);  // { bias: 0.3, aggression: 0.7 }
 *   console.log(result.seq);    // 1
 * }
 *
 * // CAS write — only succeeds if current seq matches
 * await kv.put('params:agent_1', updatedParams, { seq: 2, ifSeq: 1 });
 * ```
 *
 * @packageDocumentation
 */

import type { RememberFn, RecallFn, RecallResultItem } from './types.js';

/* ── Configuration ────────────────────────────────────────────────── */

/**
 * Options for creating a {@link KvOverlay}.
 */
export interface KvOverlayOptions {
  /**
   * Text prefix prepended to all keys in the MemWal store.
   * Acts as a namespace separator to avoid collisions with other data.
   *
   * @example `"kv:myapp"` → stored as `"kv:myapp key=params:agent_1 seq=5\n..."`
   */
  prefix: string;

  /**
   * Maximum number of recall results to inspect when reading a key.
   * Higher values increase the chance of finding the latest seq but
   * cost more relayer round-trips.
   *
   * @defaultValue 10
   */
  recallLimit?: number;
}

/* ── Result types ─────────────────────────────────────────────────── */

/**
 * A key-value entry with its sequence number.
 */
export interface KvEntry<T> {
  /** The deserialized value. */
  readonly value: T;
  /** The sequence number of this entry (highest = latest). */
  readonly seq: number;
}

/**
 * Options for a {@link KvOverlay.put} call.
 */
export interface KvPutOptions {
  /**
   * Sequence number for this write. Must be monotonically increasing
   * per key. The reader picks the highest seq as the current value.
   */
  seq: number;

  /**
   * CAS guard: only write if the current seq matches `ifSeq`.
   * Set to `0` or omit for unconditional writes.
   */
  ifSeq?: number;
}

/* ── Implementation ───────────────────────────────────────────────── */

/**
 * A key-value overlay that stores versioned JSON values in MemWal's
 * append-only semantic store.
 *
 * Values are serialized as JSON and stored with text-prefix anchors
 * for recall filtering. Reads return the entry with the highest
 * sequence number.
 */
export class KvOverlay {
  private prefix: string;
  private recallLimit: number;

  /**
   * @param remember - Function to persist text to MemWal.
   * @param recall   - Function to perform semantic search in MemWal.
   * @param opts     - Overlay configuration.
   */
  constructor(
    private remember: RememberFn,
    private recall: RecallFn,
    opts: KvOverlayOptions,
  ) {
    this.prefix = opts.prefix;
    this.recallLimit = opts.recallLimit ?? 10;
  }

  /**
   * Read the latest value for a key.
   *
   * Performs a semantic recall with the key as the query, then filters
   * results by exact key match and returns the entry with the highest
   * sequence number.
   *
   * @param key - The key to look up (e.g. `"params:dr_morgan"`).
   * @returns The latest entry, or `null` if the key has never been written.
   *
   * @example
   * ```ts
   * const entry = await kv.get<AgentParams>('params:dr_morgan');
   * if (entry) {
   *   console.log(`Version ${entry.seq}:`, entry.value);
   * }
   * ```
   */
  async get<T>(key: string): Promise<KvEntry<T> | null> {
    const anchor = this.anchor(key);
    const res = await this.recall(anchor);
    const results: RecallResultItem[] = res?.results ?? [];

    let best: KvEntry<T> | null = null;

    for (const item of results) {
      const text = item.text ?? item.content ?? '';
      const parsed = this.parse<T>(key, text);
      if (!parsed) continue;
      if (!best || parsed.seq > best.seq) best = parsed;
    }

    return best;
  }

  /**
   * Write a value for a key with a given sequence number.
   *
   * The value is serialized as JSON and stored with a text-prefix anchor:
   * ```
   * kv:myapp key=params:agent_1 seq=5
   * {"bias":0.3,"aggression":0.7}
   * ```
   *
   * @param key   - The key to write.
   * @param value - The value to store (must be JSON-serializable).
   * @param opts  - Sequence number and optional CAS guard.
   * @throws If `ifSeq` is set and the current seq does not match.
   *
   * @example
   * ```ts
   * // Unconditional write
   * await kv.put('params:dr_morgan', newParams, { seq: 5 });
   *
   * // CAS write — fails if current seq is not 4
   * await kv.put('params:dr_morgan', newParams, { seq: 5, ifSeq: 4 });
   * ```
   */
  async put<T>(key: string, value: T, opts: KvPutOptions): Promise<void> {
    if (opts.ifSeq !== undefined) {
      const current = await this.get<T>(key);
      const currentSeq = current?.seq ?? 0;
      if (currentSeq !== opts.ifSeq) {
        throw new KvVersionConflictError(key, opts.ifSeq, currentSeq);
      }
    }

    const anchor = this.anchor(key);
    const payload = `${anchor} seq=${opts.seq}\n${JSON.stringify(value)}`;
    await this.remember(payload);
  }

  /* ── Internal helpers ─────────────────────────────────────────── */

  /**
   * Build the text-prefix anchor for a key.
   * @internal
   */
  private anchor(key: string): string {
    return `${this.prefix} key=${key}`;
  }

  /**
   * Parse a recall result into a typed KvEntry, or return null if the
   * result doesn't match the expected key.
   * @internal
   */
  private parse<T>(key: string, text: string): KvEntry<T> | null {
    // Expected format: "{prefix} key={key} seq={N}\n{json}"
    const anchor = this.anchor(key);
    if (!text.startsWith(anchor)) return null;

    const headerEnd = text.indexOf('\n');
    if (headerEnd === -1) return null;

    const header = text.slice(0, headerEnd);
    const seqMatch = header.match(/\bseq=(\d+)/);
    if (!seqMatch) return null;

    const seq = parseInt(seqMatch[1]!, 10);
    const body = text.slice(headerEnd + 1);

    try {
      const value = JSON.parse(body) as T;
      return { value, seq };
    } catch {
      return null;
    }
  }
}

/* ── Error class ──────────────────────────────────────────────────── */

/**
 * Thrown when a CAS-guarded write fails because the current sequence
 * number does not match the expected value.
 */
export class KvVersionConflictError extends Error {
  readonly key: string;
  readonly expectedSeq: number;
  readonly actualSeq: number;

  constructor(key: string, expectedSeq: number, actualSeq: number) {
    super(
      `KV version conflict on "${key}": expected seq=${expectedSeq}, found seq=${actualSeq}`,
    );
    this.name = 'KvVersionConflictError';
    this.key = key;
    this.expectedSeq = expectedSeq;
    this.actualSeq = actualSeq;
  }
}
