/**
 * matchWorker | v0.1.0 | 2026-06-12
 * Purpose: The heartbeat of the cabinet. Polls the MatchProvider, makes the
 * 5 agents predict upcoming matches (deterministic engine + sleep-worker
 * calibration), resolves predictions when results arrive, bumps the sleep
 * trigger and runs the evolution pipeline. Also feeds thought bubbles so the
 * world reacts to real football.
 *
 * Idempotency: predictedMatchIds / resolvedMatchIds guards in-process;
 * prediction ids are deterministic (`pred:{matchId}:{agentId}`) so even a
 * restart cannot double-predict the same match for the same agent (the event
 * reader keyed by id de-duplicates).
 */

import type { PredictionEvent } from '@moneyball/sleep-worker'
import type { SleepService } from '../agents/sleepService'
import { predictMatch, type AgentMethodology } from './predictionEngine'
import type { Match, MatchProvider, PickCode } from './types'

const pickLabel = (m: Match, p: PickCode): string =>
  p === '1' ? `${m.homeTeam} win` : p === '2' ? `${m.awayTeam} win` : 'Draw'

export interface MatchWorkerOptions {
  pollSeconds: number
  predictionLeadHours: number
  onThought?: (agentId: string, text: string) => void
}

export class MatchWorker {
  private readonly matches = new Map<string, Match>()
  private readonly predictedMatchIds = new Set<string>()
  private readonly resolvedMatchIds = new Set<string>()
  private timer: ReturnType<typeof setInterval> | null = null
  private ticking = false

  constructor(
    private readonly provider: MatchProvider,
    private readonly agents: readonly AgentMethodology[],
    private readonly sleep: SleepService,
    private readonly opts: MatchWorkerOptions,
  ) {}

  start(): void {
    if (this.timer) return
    void this.tick()
    this.timer = setInterval(() => void this.tick(), this.opts.pollSeconds * 1000)
    console.log(`[matchWorker] started: provider=${this.provider.name} poll=${this.opts.pollSeconds}s`)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  listMatches(): readonly Match[] {
    return [...this.matches.values()].sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc))
  }

  /** One poll cycle. Public so admin endpoints/tests can force it. */
  async tick(): Promise<void> {
    if (this.ticking) return // overlapping fetches are pointless
    this.ticking = true
    try {
      const now = Date.now()
      const from = new Date(now - 2 * 86400_000).toISOString()
      const to = new Date(now + 8 * 86400_000).toISOString()
      const window = await this.provider.fetchWindow(from, to)
      for (const match of window) this.matches.set(match.id, match)

      for (const match of this.matches.values()) {
        await this.maybePredict(match, now)
        await this.maybeResolve(match)
      }
    } catch (err) {
      console.error('[matchWorker.tick]', err)
    } finally {
      this.ticking = false
    }
  }

  private async maybePredict(match: Match, nowMs: number): Promise<void> {
    if (this.predictedMatchIds.has(match.id)) return
    if (match.status === 'finished') {
      // Joined mid-tournament: never predict a known result.
      this.predictedMatchIds.add(match.id)
      return
    }
    const kickoff = Date.parse(match.kickoffUtc)
    if (kickoff - nowMs > this.opts.predictionLeadHours * 3600_000) return

    this.predictedMatchIds.add(match.id)
    const topic = `wc_${match.stage}`

    for (const agent of this.agents) {
      const raw = predictMatch(agent, match)
      const params = await this.sleep.getParams(agent.agentId)
      const effective = await this.sleep.calibrate(agent.agentId, topic, raw.rawConfidence)

      const event: PredictionEvent = {
        id: `pred:${match.id}:${agent.agentId}`,
        agentId: agent.agentId,
        userId: 'world',
        topic,
        prediction: `${pickLabel(match, raw.pick)} — ${raw.reasoning}`,
        rawConfidence: raw.rawConfidence,
        effectiveConfidence: effective,
        paramsVersion: params.version,
        outcome: null,
        disagree: null,
        ts: new Date().toISOString(),
      }
      await this.sleep.reader.recordPrediction(event, match.id, raw.pick)
      this.opts.onThought?.(
        agent.agentId,
        `${match.homeTeam} vs ${match.awayTeam}: ${pickLabel(match, raw.pick)} (${Math.round(effective * 100)}%)`,
      )
    }
    console.log(`[matchWorker] predicted ${match.id}: ${match.homeTeam} vs ${match.awayTeam}`)
  }

  private async maybeResolve(match: Match): Promise<void> {
    if (match.status !== 'finished' || match.result === null) return
    if (this.resolvedMatchIds.has(match.id)) return
    if (!this.predictedMatchIds.has(match.id)) return // nothing to grade
    this.resolvedMatchIds.add(match.id)

    const resolvedAt = new Date().toISOString()
    for (const agent of this.agents) {
      const predictionId = `pred:${match.id}:${agent.agentId}`
      const raw = predictMatch(agent, match) // deterministic ⇒ same pick as stored
      const correct = raw.pick === match.result.outcome
      await this.sleep.reader.recordOutcome(predictionId, correct, resolvedAt)
      await this.sleep.onOutcomeResolved(agent.agentId)
      this.opts.onThought?.(
        agent.agentId,
        correct
          ? `Called it. ${match.homeTeam} ${match.result.homeScore}–${match.result.awayScore} ${match.awayTeam}.`
          : `${match.homeTeam} ${match.result.homeScore}–${match.result.awayScore}… noted. Recalibrating.`,
      )
    }
    console.log(`[matchWorker] resolved ${match.id} → ${match.result.outcome}`)

    // Evolution opportunity right after grading.
    for (const agent of this.agents) {
      const result = await this.sleep.runIfDue(agent.agentId)
      if (result.kind === 'evolved' || result.kind === 'rolled_back') {
        console.log('[sleep]', agent.agentId, result)
        this.opts.onThought?.(agent.agentId, 'I dreamt of my mistakes. I am... different now.')
      }
    }
  }

  /** Used by the manual/admin path to register an externally updated match. */
  upsert(match: Match): void {
    this.matches.set(match.id, match)
  }
}
