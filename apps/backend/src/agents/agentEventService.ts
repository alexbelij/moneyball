/**
 * agentEventService | v0.5.0 | 2026-06-18
 * Purpose: Store and retrieve public agent events (predictions, outcomes,
 * evolution) via MemWal. v0.2: prediction events carry id/topic/rawConfidence/
 * paramsVersion (sleep-worker migration step 1); outcomes are separate
 * append-only events merged into predictions on read.
 * v0.3 (T40a): graceful degradation — recall() errors return [] instead of
 * propagating, preventing unhandled rejections that crash the process.
 * v0.4 (T40b): write-through materialized read-model. All list* methods read
 * from deterministic in-memory indexes (populated on every add* call), never
 * from recall(). MemWal remains the durable/provenance store. Index is
 * persisted to disk (debounced) and reloaded on boot; best-effort hydrate
 * from MemWal at startup merges without duplicates.
 * v0.5 (T76): capture blob_id from MemWal write + recall responses. Exposes
 * Walrus blob provenance on prediction/evolution items via the public API.
 */

import { MemWal } from '@mysten-incubation/memwal'
import { env } from '../config/env'
import { MemWalWriteQueue } from '../memory/memwalWriteQueue'
import { WriteJournal } from '../memory/writeJournal'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { tmpdir } from 'os'

export type AgentEventType = 'prediction' | 'outcome' | 'evolution'

export type AgentPredictionEvent = {
  schemaVersion: '1.0'
  type: 'prediction'
  agentId: string
  createdAt: string
  matchId: string
  pick: string
  confidence: number
  reasoning: string
  // v0.2 (sleep-worker migration step 1); optional = old events stay readable
  predictionId?: string
  topic?: string
  rawConfidence?: number
  paramsVersion?: number
  /** T76: Walrus blob_id captured from MemWal write/recall. */
  blobId?: string
  /** Provenance: 'seed' = deterministic baseline fixture, 'live' = real MemWal write. */
  source?: 'seed' | 'live'
  /** Merged from outcome events on read; never stored on the prediction. */
  outcome?: { correct: boolean; resolvedAt: string }
}

export type AgentOutcomeEvent = {
  schemaVersion: '1.0'
  type: 'outcome'
  agentId: string
  createdAt: string
  predictionId: string
  correct: boolean
  resolvedAt: string
}

export type AgentEvolutionEvent = {
  schemaVersion: '1.0'
  type: 'evolution'
  agentId: string
  createdAt: string
  summary: string
  parameterDiff?: Record<string, number>
  // v0.2: sleep-worker provenance
  runId?: string
  fromVersion?: number
  toVersion?: number
  evolutionType?: string
  /** T76: Walrus blob_id captured from MemWal write/recall. */
  blobId?: string
  /** Provenance: 'seed' = deterministic baseline fixture, 'live' = real MemWal write. */
  source?: 'seed' | 'live'
}

export type AgentEvent = AgentPredictionEvent | AgentOutcomeEvent | AgentEvolutionEvent

type RecallResult = { text?: string; content?: string; blob_id?: string }

/** Wide recall window for boot hydration — MemWal recall is semantic top-K. */
const HYDRATE_RECALL_TOPK = 500

function extractJson(text: string): any | null {
  // Stored as: "moneyball:agent_event ...\n{json}"
  const idx = text.indexOf('\n')
  const jsonPart = idx >= 0 ? text.slice(idx + 1) : text
  try { return JSON.parse(jsonPart) } catch { return null }
}

// ── Persistence path ─────────────────────────────────────────────────────
// On Render the app bundle (/app) is read-only, so the old default of
// <backend>/.data fails with EACCES on mkdir and disk persistence silently
// dies. Honour an explicit DATA_DIR override, else fall back to the OS temp
// dir (always writable). The read-model lives in memory regardless; this only
// gives best-effort warm-restart persistence within an instance lifetime.
let _dataDir: string
if (process.env.DATA_DIR && process.env.DATA_DIR.trim()) {
  _dataDir = resolve(process.env.DATA_DIR.trim())
} else {
  _dataDir = resolve(tmpdir(), 'moneyball-data')
}

export interface AgentEventServiceOptions {
  /**
   * Where the read-model index is persisted. Defaults to <backend>/.data.
   * Pass `null` to run fully in-memory (no disk read/write) — used by tests
   * to get a clean cold-start without touching the shared on-disk index.
   */
  dataDir?: string | null
}

export class AgentEventService {
  // Cache MemWal clients per agent namespace
  private clients = new Map<string, ReturnType<typeof MemWal.create>>()
  private writeQueues = new Map<string, MemWalWriteQueue>()
  /** Dev fallback (no MEMWAL_KEY): skip MemWal writes. Index still works. */
  readonly enabled = Boolean(env.MEMWAL_KEY)

  // Disk persistence target (instance-level so tests can isolate / disable it).
  private readonly persistEnabled: boolean
  private readonly dataDir: string
  private readonly indexPath: string

  // ── T40b: Write-through materialized read-model ──────────────────────
  private predictionIndex = new Map<string, AgentPredictionEvent[]>()
  private evolutionIndex = new Map<string, AgentEvolutionEvent[]>()
  private outcomeIndex = new Map<string, AgentOutcomeEvent[]>()
  private predictionKeys = new Set<string>()
  private evolutionKeys = new Set<string>()
  private outcomeKeys = new Set<string>()
  private persistTimer: ReturnType<typeof setTimeout> | null = null
  private dirty = false

  constructor(opts: AgentEventServiceOptions = {}) {
    this.persistEnabled = opts.dataDir !== null
    this.dataDir = opts.dataDir ?? _dataDir
    this.indexPath = resolve(this.dataDir, 'agent-index.json')
    if (this.persistEnabled) this.loadFromDisk()
  }

  // ── Dedup key helpers ────────────────────────────────────────────────
  private predKey(ev: AgentPredictionEvent): string {
    return ev.predictionId ?? `pred:${ev.agentId}:${ev.matchId}:${ev.createdAt}`
  }

  private evoKey(ev: AgentEvolutionEvent): string {
    // Prefer the sleep-worker runId (deterministic per agent+watermark) so the
    // same evolution dedups across reboots/re-seeds regardless of createdAt.
    // Fall back to createdAt+summary for legacy events that predate runId.
    if (ev.runId) return `evo:${ev.agentId}:run:${ev.runId}`
    return `evo:${ev.agentId}:${ev.createdAt}:${(ev.summary ?? '').slice(0, 40)}`
  }

  private outKey(ev: AgentOutcomeEvent): string {
    return `out:${ev.predictionId}`
  }

  // ── Index insertion (with dedup) ─────────────────────────────────────
  private indexPrediction(ev: AgentPredictionEvent): boolean {
    const key = this.predKey(ev)
    if (this.predictionKeys.has(key)) return false
    this.predictionKeys.add(key)
    const arr = this.predictionIndex.get(ev.agentId) ?? []
    arr.push(ev)
    this.predictionIndex.set(ev.agentId, arr)
    return true
  }

  private indexEvolution(ev: AgentEvolutionEvent): boolean {
    const key = this.evoKey(ev)
    if (this.evolutionKeys.has(key)) return false
    this.evolutionKeys.add(key)
    const arr = this.evolutionIndex.get(ev.agentId) ?? []
    arr.push(ev)
    this.evolutionIndex.set(ev.agentId, arr)
    return true
  }

  private indexOutcome(ev: AgentOutcomeEvent): boolean {
    const key = this.outKey(ev)
    if (this.outcomeKeys.has(key)) return false
    this.outcomeKeys.add(key)
    const arr = this.outcomeIndex.get(ev.agentId) ?? []
    arr.push(ev)
    this.outcomeIndex.set(ev.agentId, arr)
    return true
  }

  // ── Disk persistence (debounced) ─────────────────────────────────────
  private schedulePersist() {
    if (!this.persistEnabled) return
    this.dirty = true
    if (this.persistTimer) return
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      if (this.dirty) this.persistToDisk()
    }, 2000)
  }

  private persistToDisk() {
    try {
      const data = {
        predictions: Object.fromEntries(this.predictionIndex),
        evolution: Object.fromEntries(this.evolutionIndex),
        outcomes: Object.fromEntries(this.outcomeIndex),
      }
      mkdirSync(this.dataDir, { recursive: true })
      writeFileSync(this.indexPath, JSON.stringify(data), 'utf-8')
      this.dirty = false
      console.log(`[agentEvents.persist] saved to ${this.indexPath}`)
    } catch (err) {
      console.error('[agentEvents.persist] write failed:', err)
    }
  }

  private loadFromDisk() {
    try {
      const raw = readFileSync(this.indexPath, 'utf-8')
      const data = JSON.parse(raw) as {
        predictions?: Record<string, AgentPredictionEvent[]>
        evolution?: Record<string, AgentEvolutionEvent[]>
        outcomes?: Record<string, AgentOutcomeEvent[]>
      }
      let loaded = 0
      if (data.predictions) {
        for (const [agentId, events] of Object.entries(data.predictions)) {
          for (const ev of events) {
            ev.agentId = agentId // safety: ensure agentId matches key
            if (this.indexPrediction(ev)) loaded++
          }
        }
      }
      if (data.evolution) {
        for (const [agentId, events] of Object.entries(data.evolution)) {
          for (const ev of events) {
            ev.agentId = agentId
            if (this.indexEvolution(ev)) loaded++
          }
        }
      }
      if (data.outcomes) {
        for (const [agentId, events] of Object.entries(data.outcomes)) {
          for (const ev of events) {
            ev.agentId = agentId
            if (this.indexOutcome(ev)) loaded++
          }
        }
      }
      if (loaded > 0) console.log(`[agentEvents.loadFromDisk] restored ${loaded} events`)
    } catch {
      // No file or corrupt — start fresh (expected on first boot)
    }
  }

  // ── Best-effort MemWal hydrate (call once at boot, non-blocking) ────
  async hydrate(agentIds: string[]) {
    if (!this.enabled) return
    let merged = 0
    for (const agentId of agentIds) {
      for (const type of ['prediction', 'evolution', 'outcome'] as const) {
        try {
          const client = this.getClient(agentId)
          // High topK: MemWal recall is semantic top-K (no enumeration API), so
          // a default small limit silently drops most events. Pull a wide window
          // to maximise how much durable history we restore on boot. Dedup keeps
          // it safe to over-fetch.
          const res: any = await client.recall({ query: this.anchor(agentId, type), topK: HYDRATE_RECALL_TOPK, limit: HYDRATE_RECALL_TOPK })
          const results: RecallResult[] = (res?.results ?? []) as RecallResult[]
          for (const r of results) {
            const ev = extractJson(r.text ?? r.content ?? '')
            if (!ev || ev.agentId !== agentId || ev.type !== type) continue
            ev.schemaVersion = ev.schemaVersion ?? '1.0'
            // T76: capture blob_id from recall result if available
            if (r.blob_id && !ev.blobId) ev.blobId = r.blob_id
            if (type === 'prediction' && this.indexPrediction(ev)) merged++
            if (type === 'evolution' && this.indexEvolution(ev)) merged++
            if (type === 'outcome' && this.indexOutcome(ev)) merged++
          }
        } catch (err) {
          console.error(`[agentEvents.hydrate] recall failed for ${agentId}/${type}:`, err)
          // Best-effort: continue with next
        }
      }
    }
    if (merged > 0) {
      console.log(`[agentEvents.hydrate] merged ${merged} events from MemWal`)
      this.schedulePersist()
    }
  }

  // ── MemWal client / queue helpers (unchanged) ────────────────────────
  private getClient(agentId: string) {
    const ns = `mwc-agent:${agentId}`
    const cached = this.clients.get(ns)
    if (cached) return cached

    const c = MemWal.create({
      key: env.MEMWAL_KEY,
      accountId: env.MEMWAL_ACCOUNT_ID,
      serverUrl: env.MEMWAL_RELAYER,
      namespace: ns,
    })
    this.clients.set(ns, c)
    return c
  }

  private getQueue(agentId: string) {
    const q = this.writeQueues.get(agentId)
    if (q) return q

    const client = this.getClient(agentId)
    // TASK 3: on-disk journal for crash-resilient pending writes
    const journal = this.persistEnabled
      ? new WriteJournal(resolve(this.dataDir, 'journals', agentId))
      : undefined

    const queue = new MemWalWriteQueue(
      async (text) => {
        const job: any = await client.remember(text)
        if (job?.job_id) {
          const result: any = await client.waitForRememberJob(job.job_id)
          // T76: return blob_id so MemWalWriteQueue can pass it to onComplete
          return result?.blob_id as string | undefined
        }
      },
      {
        debounceMs: 1200,
        minIntervalMs: 1200,
        // T76: when a write completes with a blob_id, update the in-memory index
        onComplete: (key, blobId) => {
          if (!blobId) return
          this.attachBlobId(agentId, key, blobId)
        },
        journal,
      },
    )
    this.writeQueues.set(agentId, queue)
    return queue
  }

  /**
   * T76: Attach a blob_id to the most recent matching event in the index.
   * Queue keys are formatted as `prediction:<matchId>`, `evolution:<createdAt>`, etc.
   */
  private attachBlobId(agentId: string, queueKey: string, blobId: string) {
    if (queueKey.startsWith('prediction:')) {
      const preds = this.predictionIndex.get(agentId)
      if (preds) {
        // Find the last prediction for this agent (most recently added)
        for (let i = preds.length - 1; i >= 0; i--) {
          const p = preds[i]
          const matchKey = `prediction:${p.predictionId ?? p.matchId}`
          if (matchKey === queueKey && !p.blobId) {
            p.blobId = blobId
            this.schedulePersist()
            console.log(`[agentEvents.blobId] attached ${blobId} to prediction ${queueKey}`)
            return
          }
        }
      }
    } else if (queueKey.startsWith('evolution:')) {
      const evos = this.evolutionIndex.get(agentId)
      if (evos) {
        for (let i = evos.length - 1; i >= 0; i--) {
          if (!evos[i].blobId) {
            evos[i].blobId = blobId
            this.schedulePersist()
            console.log(`[agentEvents.blobId] attached ${blobId} to evolution ${queueKey}`)
            return
          }
        }
      }
    }
  }

  private anchor(agentId: string, type: AgentEventType) {
    return `moneyball:agent_event type=${type} agentId=${agentId}`
  }

  // ── Write methods (index first, then MemWal) ─────────────────────────
  async addPrediction(
    input: Omit<AgentPredictionEvent, 'schemaVersion' | 'type' | 'createdAt'> & { createdAt?: string },
  ) {
    const ev: AgentPredictionEvent = {
      source: 'live',
      ...input,
      schemaVersion: '1.0',
      type: 'prediction',
      createdAt: input.createdAt ?? new Date().toISOString(),
    }

    // T40b: always write-through to index (deduped)
    this.indexPrediction(ev)
    this.schedulePersist()

    if (this.enabled) {
      const text = `${this.anchor(ev.agentId, 'prediction')}\n${JSON.stringify(ev)}`
      this.getQueue(ev.agentId).enqueue(`prediction:${ev.predictionId ?? ev.matchId}`, text)
      console.log('[prediction.enqueue]', ev.agentId, ev.matchId, ev.pick)
    }
    return ev
  }

  async addOutcome(
    input: Omit<AgentOutcomeEvent, 'schemaVersion' | 'type' | 'createdAt'> & { createdAt?: string },
  ) {
    const ev: AgentOutcomeEvent = {
      ...input,
      schemaVersion: '1.0',
      type: 'outcome',
      createdAt: input.createdAt ?? new Date().toISOString(),
    }

    this.indexOutcome(ev)
    this.schedulePersist()

    if (this.enabled) {
      const text = `${this.anchor(ev.agentId, 'outcome')}\n${JSON.stringify(ev)}`
      this.getQueue(ev.agentId).enqueue(`outcome:${ev.predictionId}`, text)
      console.log('[outcome.enqueue]', ev.agentId, ev.predictionId, ev.correct)
    }
    return ev
  }

  async addEvolution(
    input: Omit<AgentEvolutionEvent, 'schemaVersion' | 'type' | 'createdAt'> & { createdAt?: string },
  ) {
    const ev: AgentEvolutionEvent = {
      source: 'live',
      ...input,
      schemaVersion: '1.0',
      type: 'evolution',
      createdAt: input.createdAt ?? new Date().toISOString(),
    }

    this.indexEvolution(ev)
    this.schedulePersist()

    if (this.enabled) {
      const text = `${this.anchor(ev.agentId, 'evolution')}\n${JSON.stringify(ev)}`
      this.getQueue(ev.agentId).enqueue(`evolution:${ev.createdAt}`, text)
      console.log('[evolution.enqueue]', ev)
    }
    return ev
  }

  // ── Read methods (T40b: always from index, deterministic) ────────────
  async listOutcomes(agentId: string, limit = 100): Promise<AgentOutcomeEvent[]> {
    const items = this.outcomeIndex.get(agentId) ?? []
    return items
      .slice()
      .sort((a, b) => (a.resolvedAt < b.resolvedAt ? 1 : -1))
      .slice(0, limit)
  }

  async listPredictions(agentId: string, limit = 20): Promise<AgentPredictionEvent[]> {
    const preds = this.predictionIndex.get(agentId) ?? []
    const sorted = preds
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit)

    // Merge outcomes by predictionId
    const outcomes = this.outcomeIndex.get(agentId) ?? []
    const byPrediction = new Map(outcomes.map(o => [o.predictionId, o]))
    return sorted.map(p => {
      const o = p.predictionId ? byPrediction.get(p.predictionId) : undefined
      return o ? { ...p, outcome: { correct: o.correct, resolvedAt: o.resolvedAt } } : p
    })
  }

  async listEvolution(agentId: string, limit = 20): Promise<AgentEvolutionEvent[]> {
    const items = this.evolutionIndex.get(agentId) ?? []
    return items
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit)
  }

  // ── Synchronous index counters (cheap; for seed guards + /health) ────
  predictionCount(agentId: string): number {
    return this.predictionIndex.get(agentId)?.length ?? 0
  }

  outcomeCount(agentId: string): number {
    return this.outcomeIndex.get(agentId)?.length ?? 0
  }

  evolutionCount(agentId: string): number {
    return this.evolutionIndex.get(agentId)?.length ?? 0
  }

  /** Non-`noop` evolutions — the substantive ones the before/after panel shows. */
  substantiveEvolutionCount(agentId: string): number {
    return (this.evolutionIndex.get(agentId) ?? []).filter((e) => e.evolutionType !== 'noop').length
  }

  /**
   * T57: read-model readiness snapshot for GET /health. Lets ops verify the
   * index is warm (rebuilt from fixture / hydrated) after a redeploy without
   * a manual re-seed.
   */
  readinessReport(agentIds: readonly string[]) {
    const agents: Record<string, {
      predictions: number
      outcomes: number
      evolutions: number
      substantiveEvolutions: number
    }> = {}
    let predictions = 0
    let outcomes = 0
    let evolutions = 0
    let substantiveEvolutions = 0
    for (const agentId of agentIds) {
      const p = this.predictionCount(agentId)
      const o = this.outcomeCount(agentId)
      const e = this.evolutionCount(agentId)
      const s = this.substantiveEvolutionCount(agentId)
      agents[agentId] = { predictions: p, outcomes: o, evolutions: e, substantiveEvolutions: s }
      predictions += p
      outcomes += o
      evolutions += e
      substantiveEvolutions += s
    }
    const ready = agentIds.every((id) => this.predictionCount(id) > 0)
    return {
      ready,
      totals: { predictions, outcomes, evolutions, substantiveEvolutions },
      agents,
    }
  }

  /**
   * T79: Write raw text to a MemWal namespace (for narratives, consensus).
   * Fire-and-forget; does not update in-memory indexes.
   */
  async rememberRaw(namespace: string, text: string): Promise<void> {
    if (!this.enabled) return
    try {
      const ns = `moneyball:${namespace}`
      const client = this.clientFor(ns)
      const job: any = await client.remember(text)
      if (job?.job_id) await client.waitForRememberJob(job.job_id)
    } catch (err) {
      console.error(`[rememberRaw:${namespace}]`, err)
    }
  }

  /** Get or create a MemWal client for a namespace. */
  private clientFor(namespace: string) {
    let client = this.clients.get(namespace)
    if (!client) {
      client = MemWal.create({
        key: env.MEMWAL_KEY,
        accountId: env.MEMWAL_ACCOUNT_ID,
        serverUrl: env.MEMWAL_RELAYER,
        namespace,
      })
      this.clients.set(namespace, client)
    }
    return client
  }
}
