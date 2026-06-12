/**
 * fakes | v0.2.0 | 2026-06-12
 * Purpose: Shared in-memory test doubles — CAS-correct FakeMemWal and a
 * FakeEventReader implementing the composite-cursor AgentEventReader port.
 */

import {
  compareByCursor,
  isAfterCursor,
  type AgentEventReader,
  type EvolutionEvent,
  type MemWalClient,
  type PredictionEvent,
  type ResolvedCursor,
  type VersionedRecord,
  type WriteOptions,
  type WriteResult,
} from '../src/index.js';

// ── In-memory MemWal fake (CAS-correct) ──────────────────────────────────────
export class FakeMemWal implements MemWalClient {
  readonly store = new Map<string, { value: unknown; memwalVersion: string }>();
  private seq = 0;
  /** Test hook: throw once on the next write matching this predicate. */
  failNextWriteMatching: ((key: string) => boolean) | null = null;

  async read<T>(key: string): Promise<VersionedRecord<T> | null> {
    const rec = this.store.get(key);
    return rec ? { value: structuredClone(rec.value) as T, memwalVersion: rec.memwalVersion } : null;
  }

  async write<T>(key: string, value: T, opts: WriteOptions): Promise<WriteResult> {
    if (this.failNextWriteMatching?.(key)) {
      this.failNextWriteMatching = null;
      throw new Error(`injected write failure on ${key}`);
    }
    const current = this.store.get(key);
    if (opts.ifVersion === null && current !== undefined) {
      return { ok: false, reason: 'version_conflict' };
    }
    if (typeof opts.ifVersion === 'string' && current?.memwalVersion !== opts.ifVersion) {
      return { ok: false, reason: 'version_conflict' };
    }
    const memwalVersion = `v${++this.seq}`;
    this.store.set(key, { value: structuredClone(value), memwalVersion });
    return { ok: true, memwalVersion };
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async listKeys(prefix: string): Promise<readonly string[]> {
    return [...this.store.keys()].filter((k) => k.startsWith(prefix));
  }
}

// ── Fake AgentEventService adapter (composite cursor) ────────────────────────
export class FakeEventReader implements AgentEventReader {
  readonly predictions: PredictionEvent[] = [];
  readonly evolutions: EvolutionEvent[] = [];

  async listResolvedSince(
    agentId: string,
    after: ResolvedCursor | null,
    limit: number,
  ): Promise<readonly PredictionEvent[]> {
    return this.predictions
      .filter((e) => e.agentId === agentId && e.outcome !== null && isAfterCursor(e, after))
      .sort(compareByCursor)
      .slice(0, limit);
  }

  async appendEvolutionEvent(event: EvolutionEvent): Promise<void> {
    this.evolutions.push(event);
  }

  async getEvolutionEventForRun(agentId: string, runId: string): Promise<EvolutionEvent | null> {
    return this.evolutions.find((e) => e.agentId === agentId && e.runId === runId) ?? null;
  }
}

export function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
}
