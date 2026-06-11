/**
 * MemWalUserSummaryStore | v0.2.0 | 2026-06-08
 * Purpose: Persist user summaries in Walrus Memory (MemWal) with caching + write coalescing.
 */

import { MemWal } from '@mysten-incubation/memwal'
import type { UserSummary, UserSummaryStore } from './userSummaryStore'
import { env } from '../config/env'
import { MemWalWriteQueue } from './memwalWriteQueue'

type RecallResult = { text?: string; content?: string }

function decode(text: string): UserSummary | null {
  try {
    return JSON.parse(text) as UserSummary
  } catch {
    return null
  }
}

type CacheEntry = { summary: UserSummary; cachedAtMs: number }

export class MemWalUserSummaryStore implements UserSummaryStore {
  private memwal = MemWal.create({
    key: env.MEMWAL_KEY,
    accountId: env.MEMWAL_ACCOUNT_ID,
    serverUrl: env.MEMWAL_RELAYER,
    namespace: env.MEMWAL_NAMESPACE,
  })

  private cache = new Map<string, CacheEntry>()
  private cacheTtlMs = 30_000

  private writeQueue = new MemWalWriteQueue(
    async (text) => {
      const job: any = await this.memwal.remember(text)
      if (job?.job_id) await this.memwal.waitForRememberJob(job.job_id)
    },
    { debounceMs: 1500, minIntervalMs: 1200 },
  )

  private anchor(userId: string): string {
    return `moneyball:user_summary userId=${userId}`
  }

  private fresh(userId: string): UserSummary {
    return {
      schemaVersion: '1.0',
      guestId: userId,
      updatedAt: new Date().toISOString(),
      sessionsCount: 1,
      agentDisagreeCounts: {},
      takeaways: ['Day 1: no strong opinions yet.'],
    }
  }

  async health(): Promise<void> {
    await this.memwal.health()
  }

  async getOrCreate(userId: string): Promise<UserSummary> {
    const cached = this.cache.get(userId)
    if (cached && Date.now() - cached.cachedAtMs < this.cacheTtlMs) {
      return cached.summary
    }

    try {
      const res: any = await this.memwal.recall(this.anchor(userId))
      const results: RecallResult[] = (res?.results ?? []) as RecallResult[]

      let best: UserSummary | null = null
      for (const r of results) {
        const text = r.text ?? r.content ?? ''
        const parsed = decode(text)
        if (!parsed) continue
        if (!best || parsed.updatedAt > best.updatedAt) best = parsed
      }

      if (best) {
        this.cache.set(userId, { summary: best, cachedAtMs: Date.now() })
        return best
      }
    } catch (e) {
      // Do not crash server on relayer/network issues.
      console.warn('[MemWal] recall failed, returning fresh:', e)
    }

    const fresh = this.fresh(userId)
    this.cache.set(userId, { summary: fresh, cachedAtMs: Date.now() })
    this.writeQueue.enqueue(userId, `${this.anchor(userId)}\n${JSON.stringify(fresh)}`)
    return fresh
  }

  async recordDisagree(userId: string, agentId: string): Promise<UserSummary> {
    const summary = await this.getOrCreate(userId)

    summary.agentDisagreeCounts[agentId] = (summary.agentDisagreeCounts[agentId] ?? 0) + 1
    summary.lastAgentId = agentId
    summary.updatedAt = new Date().toISOString()

    const count = summary.agentDisagreeCounts[agentId]
    if (count === 1) summary.takeaways.unshift(`You disagreed with ${agentId} for the first time.`)
    else if (count === 3) summary.takeaways.unshift(`Pattern detected: you keep disagreeing with ${agentId}.`)
    else if (count === 5) summary.takeaways.unshift(`Bias locked in: you almost always argue with ${agentId}.`)

    summary.takeaways = summary.takeaways.slice(0, 12)

    // fast UI
    this.cache.set(userId, { summary, cachedAtMs: Date.now() })

    // coalesced write
    this.writeQueue.enqueue(userId, `${this.anchor(userId)}\n${JSON.stringify(summary)}`)

    return summary
  }
}
