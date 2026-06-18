/**
 * sleepAdapters | v0.1.0 | 2026-06-12
 * Purpose: Backend-side implementations of the two sleep-worker ports.
 *
 *  1) KvMemWalClient (MemWalClient port)
 *     MemWal's API is remember/recall (append-only, semantic), not KV-with-CAS.
 *     Authoritative state therefore lives in-process (single backend instance =
 *     single writer ⇒ CAS on a Map is sound), and EVERY accepted write is
 *     mirrored to MemWal as an anchored record — the durable, judge-visible
 *     trail on Walrus mainnet. Matches decision D4 ("latest pointers off-chain,
 *     durable record in MemWal"). Restart hydration is best-effort via recall:
 *     worst case agents resume from defaults while the full evolution history
 *     stays readable in MemWal (documented MVP risk; V2 = Quilt KV manifest).
 *
 *  2) BackendEventReader (AgentEventReader port)
 *     In-process prediction/outcome/evolution log (authoritative, composite
 *     (resolvedAt, eventId) cursor) mirroring every event to AgentEventService
 *     so the public endpoints and MemWal history stay in sync.
 */

import { MemWal } from '@mysten-incubation/memwal'
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
} from '@moneyball/sleep-worker'
import { env } from '../config/env'
import { MemWalWriteQueue } from '../memory/memwalWriteQueue'
import { AgentEventService } from './agentEventService'

// ── 1) KV over MemWal ────────────────────────────────────────────────────────

const KV_ANCHOR = 'moneyball:sys_kv'

type KvRecord = { value: unknown; memwalVersion: string; seq: number }

export class KvMemWalClient implements MemWalClient {
  private readonly map = new Map<string, KvRecord>()
  private seq = 0
  private readonly queue: MemWalWriteQueue | null

  constructor() {
    if (env.STORAGE_BACKEND === 'memwal' && env.MEMWAL_KEY) {
      const client = MemWal.create({
        key: env.MEMWAL_KEY,
        accountId: env.MEMWAL_ACCOUNT_ID,
        serverUrl: env.MEMWAL_RELAYER,
        namespace: `${env.MEMWAL_NAMESPACE}:sys`,
      })
      this.queue = new MemWalWriteQueue(
        async (text) => {
          const job: any = await client.remember(text)
          if (job?.job_id) {
            const result: any = await client.waitForRememberJob(job.job_id)
            return result?.blob_id as string | undefined
          }
        },
        { debounceMs: 1500, minIntervalMs: 1500 },
      )
    } else {
      this.queue = null
    }
  }

  async read<T>(key: string): Promise<VersionedRecord<T> | null> {
    const rec = this.map.get(key)
    if (!rec) return null
    return { value: structuredClone(rec.value) as T, memwalVersion: rec.memwalVersion }
  }

  async write<T>(key: string, value: T, opts: WriteOptions): Promise<WriteResult> {
    const current = this.map.get(key)
    if (opts.ifVersion === null && current !== undefined) {
      return { ok: false, reason: 'version_conflict' }
    }
    if (typeof opts.ifVersion === 'string' && current?.memwalVersion !== opts.ifVersion) {
      return { ok: false, reason: 'version_conflict' }
    }
    const seq = ++this.seq
    const memwalVersion = `s${seq}`
    this.map.set(key, { value: structuredClone(value), memwalVersion, seq })

    // Durable mirror. Coalescing by key is safe: MemWal keeps the append-only
    // history; the latest record per key is what hydration looks for.
    this.queue?.enqueue(
      `kv:${key}`,
      `${KV_ANCHOR} key=${key} seq=${seq}\n${JSON.stringify({ key, seq, value })}`,
    )
    return { ok: true, memwalVersion }
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key)
    this.queue?.enqueue(`kv:${key}`, `${KV_ANCHOR} key=${key} deleted=true\n{"key":"${key}","deleted":true}`)
  }

  async listKeys(prefix: string): Promise<readonly string[]> {
    return [...this.map.keys()].filter((k) => k.startsWith(prefix))
  }
}

// ── 2) Event reader over AgentEventService ───────────────────────────────────

export class BackendEventReader implements AgentEventReader {
  private readonly predictions = new Map<string, PredictionEvent>()
  private readonly evolutions: EvolutionEvent[] = []

  constructor(private readonly publicEvents: AgentEventService) {}

  /** Called by the match worker when an agent makes a prediction. */
  async recordPrediction(event: PredictionEvent, matchId: string, pickLabel: string): Promise<void> {
    this.predictions.set(event.id, event)
    await this.publicEvents.addPrediction({
      agentId: event.agentId,
      matchId,
      pick: pickLabel,
      confidence: event.effectiveConfidence,
      reasoning: event.prediction,
      predictionId: event.id,
      topic: event.topic,
      rawConfidence: event.rawConfidence,
      paramsVersion: event.paramsVersion,
    })
  }

  /** Called by the match worker when the match result is known. */
  async recordOutcome(predictionId: string, correct: boolean, resolvedAt: string): Promise<void> {
    const existing = this.predictions.get(predictionId)
    if (!existing || existing.outcome !== null) return
    this.predictions.set(predictionId, { ...existing, outcome: { correct, resolvedAt } })
    await this.publicEvents.addOutcome({
      agentId: existing.agentId,
      predictionId,
      correct,
      resolvedAt,
    })
  }

  // --- AgentEventReader port ---

  async listResolvedSince(
    agentId: string,
    after: ResolvedCursor | null,
    limit: number,
  ): Promise<readonly PredictionEvent[]> {
    return [...this.predictions.values()]
      .filter((e) => e.agentId === agentId && e.outcome !== null && isAfterCursor(e, after))
      .sort(compareByCursor)
      .slice(0, limit)
  }

  async appendEvolutionEvent(event: EvolutionEvent): Promise<void> {
    this.evolutions.push(event)
    const parameterDiff: Record<string, number> = {}
    for (const d of event.deltas) {
      const name = d.kind === 'topicMultiplier' ? `topic.${d.topic}` : d.kind
      parameterDiff[name] = Number((d.to - d.from).toFixed(4))
    }
    await this.publicEvents.addEvolution({
      agentId: event.agentId,
      summary: event.diagnosis,
      parameterDiff,
      runId: event.runId,
      fromVersion: event.fromVersion,
      toVersion: event.toVersion,
      evolutionType: event.type,
    })
  }

  async getEvolutionEventForRun(agentId: string, runId: string): Promise<EvolutionEvent | null> {
    return this.evolutions.find((e) => e.agentId === agentId && e.runId === runId) ?? null
  }
}
