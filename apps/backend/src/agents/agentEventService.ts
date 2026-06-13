/**
 * agentEventService | v0.3.0 | 2026-06-14
 * Purpose: Store and retrieve public agent events (predictions, outcomes,
 * evolution) via MemWal. v0.2: prediction events carry id/topic/rawConfidence/
 * paramsVersion (sleep-worker migration step 1); outcomes are separate
 * append-only events merged into predictions on read.
 * v0.3 (T40a): graceful degradation — recall() errors return [] instead of
 * propagating, preventing unhandled rejections that crash the process.
 */

import { MemWal } from '@mysten-incubation/memwal'
import { env } from '../config/env'
import { MemWalWriteQueue } from '../memory/memwalWriteQueue'

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
}

export type AgentEvent = AgentPredictionEvent | AgentOutcomeEvent | AgentEvolutionEvent

type RecallResult = { text?: string; content?: string }

function extractJson(text: string): any | null {
  // Stored as: "moneyball:agent_event ...\n{json}"
  const idx = text.indexOf('\n')
  const jsonPart = idx >= 0 ? text.slice(idx + 1) : text
  try { return JSON.parse(jsonPart) } catch { return null }
}

export class AgentEventService {
  // Cache MemWal clients per agent namespace
  private clients = new Map<string, ReturnType<typeof MemWal.create>>()
  private writeQueues = new Map<string, MemWalWriteQueue>()
  /** Dev fallback (no MEMWAL_KEY): keep events in-process so the pipeline still works. */
  private readonly enabled = Boolean(env.MEMWAL_KEY)
  private readonly localLog: AgentEvent[] = []

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
    const queue = new MemWalWriteQueue(
      async (text) => {
        const job: any = await client.remember(text)
        if (job?.job_id) await client.waitForRememberJob(job.job_id)
      },
      { debounceMs: 1200, minIntervalMs: 1200 },
    )
    this.writeQueues.set(agentId, queue)
    return queue
  }

  private anchor(agentId: string, type: AgentEventType) {
    return `moneyball:agent_event type=${type} agentId=${agentId}`
  }

  async addPrediction(input: Omit<AgentPredictionEvent, 'schemaVersion' | 'type' | 'createdAt'>) {
    const ev: AgentPredictionEvent = {
      schemaVersion: '1.0',
      type: 'prediction',
      createdAt: new Date().toISOString(),
      ...input,
    }

    if (!this.enabled) { this.localLog.push(ev); return ev }
    const text = `${this.anchor(ev.agentId, 'prediction')}\n${JSON.stringify(ev)}`
    this.getQueue(ev.agentId).enqueue(`prediction:${ev.predictionId ?? ev.matchId}`, text)
    console.log('[prediction.enqueue]', ev.agentId, ev.matchId, ev.pick)
    return ev
  }

  async addOutcome(input: Omit<AgentOutcomeEvent, 'schemaVersion' | 'type' | 'createdAt'>) {
    const ev: AgentOutcomeEvent = {
      schemaVersion: '1.0',
      type: 'outcome',
      createdAt: new Date().toISOString(),
      ...input,
    }

    if (!this.enabled) { this.localLog.push(ev); return ev }
    const text = `${this.anchor(ev.agentId, 'outcome')}\n${JSON.stringify(ev)}`
    this.getQueue(ev.agentId).enqueue(`outcome:${ev.predictionId}`, text)
    console.log('[outcome.enqueue]', ev.agentId, ev.predictionId, ev.correct)
    return ev
  }

  async listOutcomes(agentId: string, limit = 100): Promise<AgentOutcomeEvent[]> {
    if (!this.enabled) {
      return (this.localLog.filter(e => e.type === 'outcome' && e.agentId === agentId) as AgentOutcomeEvent[])
        .slice(-limit)
    }
    try {
      const client = this.getClient(agentId)
      const res: any = await client.recall(this.anchor(agentId, 'outcome'))
      const results: RecallResult[] = (res?.results ?? []) as RecallResult[]

      const parsed = results
        .map(r => extractJson(r.text ?? r.content ?? ''))
        .filter(Boolean)
        .filter((x: any) => x.type === 'outcome' && x.agentId === agentId) as AgentOutcomeEvent[]

      parsed.sort((a, b) => (a.resolvedAt < b.resolvedAt ? 1 : -1))
      return parsed.slice(0, limit)
    } catch (err) {
      console.error('[agentEvents.listOutcomes] recall failed, returning []:', err)
      return []
    }
  }

  async addEvolution(input: Omit<AgentEvolutionEvent, 'schemaVersion' | 'type' | 'createdAt'>) {
    const ev: AgentEvolutionEvent = {
      schemaVersion: '1.0',
      type: 'evolution',
      createdAt: new Date().toISOString(),
      ...input,
    }

    if (!this.enabled) { this.localLog.push(ev); return ev }
    const text = `${this.anchor(ev.agentId, 'evolution')}\n${JSON.stringify(ev)}`
    this.getQueue(ev.agentId).enqueue(`evolution:${ev.createdAt}`, text)
    console.log('[evolution.enqueue]', ev)
    return ev
  }

  async listPredictions(agentId: string, limit = 20): Promise<AgentPredictionEvent[]> {
    if (!this.enabled) {
      const preds = (this.localLog.filter(e => e.type === 'prediction' && e.agentId === agentId) as AgentPredictionEvent[])
        .slice(-limit).reverse()
      const outs = this.localLog.filter(e => e.type === 'outcome' && e.agentId === agentId) as AgentOutcomeEvent[]
      const byPrediction = new Map(outs.map(o => [o.predictionId, o]))
      return preds.map(p => {
        const o = p.predictionId ? byPrediction.get(p.predictionId) : undefined
        return o ? { ...p, outcome: { correct: o.correct, resolvedAt: o.resolvedAt } } : p
      })
    }
    try {
      const client = this.getClient(agentId)
      const res: any = await client.recall(this.anchor(agentId, 'prediction'))
      const results: RecallResult[] = (res?.results ?? []) as RecallResult[]

      const parsed = results
        .map(r => extractJson(r.text ?? r.content ?? ''))
        .filter(Boolean)
        .filter((x: any) => x.type === 'prediction' && x.agentId === agentId) as AgentPredictionEvent[]

      parsed.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      const top = parsed.slice(0, limit)

      // Merge outcomes by predictionId (best effort — recall is approximate).
      try {
        const outcomes = await this.listOutcomes(agentId)
        const byPrediction = new Map(outcomes.map(o => [o.predictionId, o]))
        return top.map(p => {
          const o = p.predictionId ? byPrediction.get(p.predictionId) : undefined
          return o ? { ...p, outcome: { correct: o.correct, resolvedAt: o.resolvedAt } } : p
        })
      } catch {
        return top
      }
    } catch (err) {
      console.error('[agentEvents.listPredictions] recall failed, returning []:', err)
      return []
    }
  }

  async listEvolution(agentId: string, limit = 20): Promise<AgentEvolutionEvent[]> {
    if (!this.enabled) {
      return (this.localLog.filter(e => e.type === 'evolution' && e.agentId === agentId) as AgentEvolutionEvent[])
        .slice(-limit).reverse()
    }
    try {
      const client = this.getClient(agentId)
      const res: any = await client.recall(this.anchor(agentId, 'evolution'))
      const results: RecallResult[] = (res?.results ?? []) as RecallResult[]

      const parsed = results
        .map(r => extractJson(r.text ?? r.content ?? ''))
        .filter(Boolean)
        .filter((x: any) => x.type === 'evolution' && x.agentId === agentId) as AgentEvolutionEvent[]

      parsed.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      return parsed.slice(0, limit)
    } catch (err) {
      console.error('[agentEvents.listEvolution] recall failed, returning []:', err)
      return []
    }
  }
}
