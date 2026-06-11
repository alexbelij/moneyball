/**
 * agentEventService | v0.1.0 | 2026-06-09
 * Purpose: Store and retrieve public agent events (predictions, evolution) via MemWal.
 */

import { MemWal } from '@mysten-incubation/memwal'
import { env } from '../config/env'
import { MemWalWriteQueue } from '../memory/memwalWriteQueue'

export type AgentEventType = 'prediction' | 'evolution'

export type AgentPredictionEvent = {
  schemaVersion: '1.0'
  type: 'prediction'
  agentId: string
  createdAt: string
  matchId: string
  pick: string
  confidence: number
  reasoning: string
}

export type AgentEvolutionEvent = {
  schemaVersion: '1.0'
  type: 'evolution'
  agentId: string
  createdAt: string
  summary: string
  parameterDiff?: Record<string, number>
}

export type AgentEvent = AgentPredictionEvent | AgentEvolutionEvent

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

    const text = `${this.anchor(ev.agentId, 'prediction')}\n${JSON.stringify(ev)}`
    this.getQueue(ev.agentId).enqueue(`prediction:${ev.matchId}`, text)
    console.log('[prediction.enqueue]', ev)
    return ev
  }

  async addEvolution(input: Omit<AgentEvolutionEvent, 'schemaVersion' | 'type' | 'createdAt'>) {
    const ev: AgentEvolutionEvent = {
      schemaVersion: '1.0',
      type: 'evolution',
      createdAt: new Date().toISOString(),
      ...input,
    }

    const text = `${this.anchor(ev.agentId, 'evolution')}\n${JSON.stringify(ev)}`
    this.getQueue(ev.agentId).enqueue(`evolution:${ev.createdAt}`, text)
    console.log('[evolution.enqueue]', ev)
    return ev
  }

  async listPredictions(agentId: string, limit = 20): Promise<AgentPredictionEvent[]> {
    const client = this.getClient(agentId)
    const res: any = await client.recall(this.anchor(agentId, 'prediction'))
    const results: RecallResult[] = (res?.results ?? []) as RecallResult[]

    const parsed = results
      .map(r => extractJson(r.text ?? r.content ?? ''))
      .filter(Boolean)
      .filter((x: any) => x.type === 'prediction' && x.agentId === agentId) as AgentPredictionEvent[]

    parsed.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    return parsed.slice(0, limit)
  }

  async listEvolution(agentId: string, limit = 20): Promise<AgentEvolutionEvent[]> {
    const client = this.getClient(agentId)
    const res: any = await client.recall(this.anchor(agentId, 'evolution'))
    const results: RecallResult[] = (res?.results ?? []) as RecallResult[]

    const parsed = results
      .map(r => extractJson(r.text ?? r.content ?? ''))
      .filter(Boolean)
      .filter((x: any) => x.type === 'evolution' && x.agentId === agentId) as AgentEvolutionEvent[]

    parsed.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    return parsed.slice(0, limit)
  }
}
