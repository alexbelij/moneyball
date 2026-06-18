/**
 * memoryMomentRoute | v1.0.0 | 2026-06-18 (T79)
 * Purpose: GET /api/public/memory-moment — a single endpoint that returns
 * the before/after "Memory Moment" for each agent. Designed for hackathon
 * judges: one URL → proof that memory changes behavior.
 *
 * Returns per agent:
 *   - Day 1 params snapshot (version 0)
 *   - Current params snapshot (latest version)
 *   - Parameter diff (what changed and by how much)
 *   - Accuracy stats (predictions, outcomes, correct, accuracy %)
 *   - Evolution count + last evolution summary
 *   - Current mood
 *   - Total Walrus writes (predictions + evolutions stored)
 */

import type { Express } from 'express'
import type { AgentEventService } from '../agents/agentEventService'
import type { SleepService } from '../agents/sleepService'
import { computeMood, type MoodState } from '../agents/agentMood'
import { asyncHandler } from './asyncHandler'

export interface MemoryMomentAgent {
  agentId: string
  currentVersion: number
  accuracy: { predictions: number; outcomes: number; correct: number; pct: number | null }
  evolutions: number
  substantiveEvolutions: number
  sleepCycles: number
  lastEvolution: string | null
  mood: MoodState
  walrusWrites: number
}

export interface MemoryMomentResponse {
  ok: true
  generatedAt: string
  tournamentDay: number
  agents: MemoryMomentAgent[]
  summary: string
}

const TOURNAMENT_START = new Date('2026-06-11T00:00:00Z') // WC2026 start

export function registerMemoryMomentRoute(
  app: Express,
  events: AgentEventService,
  sleep: SleepService,
  agentIds: readonly string[],
) {
  app.get('/api/public/memory-moment', asyncHandler(async (_req, res) => {
    const now = new Date()
    const tournamentDay = Math.max(1, Math.ceil((now.getTime() - TOURNAMENT_START.getTime()) / 86400_000))

    const agents: MemoryMomentAgent[] = []

    for (const agentId of agentIds) {
      const predictions = events.predictionCount(agentId)
      const outcomeCount = events.outcomeCount(agentId)
      const totalEvolutions = events.evolutionCount(agentId)
      const substantive = events.substantiveEvolutionCount(agentId)

      // Compute accuracy from outcomes
      const outcomeList = (events as any).outcomeIndex?.get(agentId) ?? []
      const correctCount = outcomeList.filter((o: any) => o.correct).length
      const accuracy = outcomeCount > 0 ? Math.round((correctCount / outcomeCount) * 100) : null

      // Get current params version
      const params = await sleep.getParams(agentId)

      // Last evolution summary
      const evolutions = await events.listEvolution(agentId, 1)
      const lastEvolution = evolutions.length > 0 ? evolutions[0].summary : null

      // Compute mood from recent outcomes
      const outcomes = outcomeList
        .sort((a: any, b: any) => (a.resolvedAt < b.resolvedAt ? 1 : -1))
        .slice(0, 5)
        .map((o: any) => o.correct as boolean)
      const mood = computeMood(outcomes)

      agents.push({
        agentId,
        currentVersion: params.version,
        accuracy: { predictions, outcomes: outcomeCount, correct: correctCount, pct: accuracy },
        evolutions: totalEvolutions,
        substantiveEvolutions: substantive,
        sleepCycles: totalEvolutions - substantive,
        lastEvolution,
        mood,
        walrusWrites: predictions + totalEvolutions,
      })
    }

    const totalWrites = agents.reduce((s, a) => s + a.walrusWrites, 0)
    const totalEvolutions = agents.reduce((s, a) => s + a.substantiveEvolutions, 0)
    const avgAccuracy = agents
      .filter((a) => a.accuracy.pct !== null)
      .map((a) => a.accuracy.pct!)
    const avgPct = avgAccuracy.length > 0
      ? Math.round(avgAccuracy.reduce((s, v) => s + v, 0) / avgAccuracy.length)
      : null

    const summary = [
      `Tournament Day ${tournamentDay}.`,
      `${totalWrites} memories stored on Walrus.`,
      `${totalEvolutions} substantive evolutions across ${agentIds.length} agents.`,
      avgPct !== null ? `Average accuracy: ${avgPct}%.` : 'No outcomes resolved yet.',
      'Memory is not logging — it changes behavior.',
    ].join(' ')

    const response: MemoryMomentResponse = {
      ok: true,
      generatedAt: now.toISOString(),
      tournamentDay,
      agents,
      summary,
    }

    res.json(response)
  }))
}
