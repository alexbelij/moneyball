import type { Clock } from '../memory/MemWalClient.js';
import type { AgentEventReader, PredictionEvent, ResolvedCursor } from '../events/types.js';
import type { AgentParamsStore } from '../params/AgentParamsStore.js';
import type { ReflectionEngine } from '../reflection/ReflectionEngine.js';
import type { EvolutionEngine } from '../evolution/EvolutionEngine.js';
import { SleepLock } from './SleepLock.js';
import { SleepStateStore } from './SleepStateStore.js';
import type { SleepRunResult, SleepState } from './SleepState.js';

/**
 * SleepWorker — orchestrates one sleep run per agent:
 *
 *   trigger check → LOCK → COLLECT → REFLECT → EVOLVE → COMMIT → release
 *
 * Production properties:
 *   - Zero downtime: the agent keeps serving on params vN until COMMIT.
 *   - At most one run per agent: SleepLock (CAS + TTL).
 *   - Idempotent: runId is deterministic per (agent, watermark); the evolution
 *     event id derives from runId, so a crash-re-run never double-applies.
 *   - Crash-safe ordering: EvolutionEvent (audit) → params version → SleepState
 *     COMMIT. A crash between steps leaves a resumable, detectable state.
 *   - LLM-free: reflection is pure arithmetic over resolved outcomes.
 */

export interface SleepWorkerConfig {
  /** Sleep is due after this many newly resolved outcomes... */
  readonly minResolvedToSleep: number;
  /** ...or after this much time, if at least minResolvedForTimeTrigger arrived. */
  readonly maxHoursBetweenSleeps: number;
  readonly minResolvedForTimeTrigger: number;
  /** Hard floor between two sleeps of one agent. */
  readonly minMinutesBetweenSleeps: number;
  /** Max resolved events fetched per run (window cap). */
  readonly collectLimit: number;
  /** Alert threshold (surfaced via result; alerting is the caller's job). */
  readonly maxConsecutiveAborts: number;
}

export const DEFAULT_SLEEP_CONFIG: SleepWorkerConfig = {
  minResolvedToSleep: 50,
  maxHoursBetweenSleeps: 24,
  minResolvedForTimeTrigger: 10,
  minMinutesBetweenSleeps: 60,
  collectLimit: 500,
  maxConsecutiveAborts: 3,
};

export class SleepWorker {
  constructor(
    private readonly deps: {
      readonly stateStore: SleepStateStore;
      readonly lock: SleepLock;
      readonly eventReader: AgentEventReader;
      readonly paramsStore: AgentParamsStore;
      readonly reflection: ReflectionEngine;
      readonly evolution: EvolutionEngine;
      readonly clock: Clock;
    },
    private readonly cfg: SleepWorkerConfig = DEFAULT_SLEEP_CONFIG,
  ) {}

  /** Entry point for the job consumer. Safe to call at any frequency. */
  async runIfDue(agentId: string): Promise<SleepRunResult> {
    let state = await this.deps.stateStore.get(agentId);
    if (!this.isDue(state)) return { kind: 'not_due' };

    // Deterministic runId: same agent + same watermark ⇒ same run identity.
    const runId = runIdOf(agentId, state);

    const lockHandle = await this.deps.lock.tryAcquire(agentId, runId);
    if (lockHandle === null) return { kind: 'lock_busy' };

    try {
      // FIX 1.3 (TOCTOU): re-read state under the lock. If another worker
      // committed between our read and acquire, the stale state would burn
      // cooldowns twice and overwrite lastSleepAt via commitSleep.
      state = await this.deps.stateStore.get(agentId);
      if (runIdOf(agentId, state) !== runId || !this.isDue(state)) {
        return { kind: 'lock_busy' };
      }
      return await this.run(agentId, runId, state);
    } catch (error) {
      await this.deps.stateStore.recordAbort(agentId);
      return {
        kind: 'aborted',
        runId,
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      };
    } finally {
      await lockHandle.release();
    }
  }

  private async run(
    agentId: string,
    runId: string,
    state: SleepState,
  ): Promise<SleepRunResult> {
    const { stateStore, eventReader, paramsStore, reflection, evolution, clock } = this.deps;

    await stateStore.saveCheckpoint({
      agentId,
      runId,
      completedPhase: null,
      attempt: state.consecutiveAborts + 1,
      startedAt: clock.nowIso(),
    });

    // ── COLLECT ──────────────────────────────────────────────────────────────
    const events: readonly PredictionEvent[] = await eventReader.listResolvedSince(
      agentId,
      state.resolvedWatermark,
      this.cfg.collectLimit,
    );
    if (events.length === 0) {
      await stateStore.clearCheckpoint(agentId);
      return { kind: 'noop', runId, reason: 'no newly resolved events' };
    }
    const newWatermark = maxCursor(events);
    await stateStore.saveCheckpoint({
      agentId,
      runId,
      completedPhase: 'COLLECT',
      attempt: state.consecutiveAborts + 1,
      startedAt: clock.nowIso(),
    });

    // ── REFLECT ─────────────────────────────────────────────────────────────
    // Always fresh params (never the 30s cache) — we are about to CAS on version.
    const params = await paramsStore.getOrCreate(agentId);
    const reflected = reflection.reflect({
      params,
      events,
      topicCooldowns: state.topicCooldowns,
    });
    await stateStore.saveCheckpoint({
      agentId,
      runId,
      completedPhase: 'REFLECT',
      attempt: state.consecutiveAborts + 1,
      startedAt: clock.nowIso(),
    });

    // ── EVOLVE ──────────────────────────────────────────────────────────────
    const outcome = await evolution.evolve(
      agentId,
      runId,
      params,
      reflected,
      events.map((e) => e.id),
    );
    await stateStore.saveCheckpoint({
      agentId,
      runId,
      completedPhase: 'EVOLVE',
      attempt: state.consecutiveAborts + 1,
      startedAt: clock.nowIso(),
    });

    // ── COMMIT ──────────────────────────────────────────────────────────────
    const committedVersion =
      outcome.kind === 'applied' || outcome.kind === 'rolled_back'
        ? outcome.params.version
        : params.version;

    await stateStore.commitSleep(agentId, {
      resolvedWatermark: newWatermark,
      adjustedTopics: reflected.adjustedTopics,
      topicCooldownSleeps: reflection.config.topicCooldownSleeps,
      paramsVersion: committedVersion,
      processedCount: events.length,
    });
    await stateStore.clearCheckpoint(agentId);

    switch (outcome.kind) {
      case 'applied':
        return {
          kind: 'evolved',
          runId,
          fromVersion: params.version,
          toVersion: outcome.params.version,
        };
      case 'rolled_back':
        return { kind: 'rolled_back', runId, toVersion: outcome.params.version };
      case 'noop':
        return { kind: 'noop', runId, reason: outcome.event.diagnosis };
      case 'skipped_duplicate_run':
        return { kind: 'noop', runId, reason: 'evolution already applied for this run' };
    }
  }

  private isDue(state: SleepState): boolean {
    const now = this.deps.clock.nowMs();
    const lastSleepMs = state.lastSleepAt === null ? 0 : Date.parse(state.lastSleepAt);
    const minutesSince = (now - lastSleepMs) / 60_000;

    if (minutesSince < this.cfg.minMinutesBetweenSleeps) return false;
    if (state.resolvedSinceSleep >= this.cfg.minResolvedToSleep) return true;
    return (
      minutesSince >= this.cfg.maxHoursBetweenSleeps * 60 &&
      state.resolvedSinceSleep >= this.cfg.minResolvedForTimeTrigger
    );
  }
}

function runIdOf(agentId: string, state: SleepState): string {
  const wm =
    state.resolvedWatermark === null
      ? 'genesis'
      : `${state.resolvedWatermark.resolvedAt}#${state.resolvedWatermark.eventId}`;
  return `${agentId}:${wm}:${state.paramsVersionAtLastSleep}`;
}

/** FIX 2.2: watermark is the max composite (resolvedAt, eventId) cursor. */
function maxCursor(events: readonly PredictionEvent[]): ResolvedCursor | null {
  let max: ResolvedCursor | null = null;
  for (const e of events) {
    const resolvedAt = e.outcome?.resolvedAt;
    if (resolvedAt === undefined) continue;
    if (
      max === null ||
      resolvedAt > max.resolvedAt ||
      (resolvedAt === max.resolvedAt && e.id > max.eventId)
    ) {
      max = { resolvedAt, eventId: e.id };
    }
  }
  return max;
}

