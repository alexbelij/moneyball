import type { Clock } from '../memory/MemWalClient.js';
import type { AgentParams, ParamDelta } from '../params/AgentParams.js';
import { PARAM_BOUNDS, deltaMagnitude } from '../params/AgentParams.js';
import type { AgentParamsStore } from '../params/AgentParamsStore.js';
import type { AgentEventReader, EvolutionEvent } from '../events/types.js';
import type { ReflectionResult } from '../reflection/ReflectionEngine.js';

/**
 * EvolutionEngine — the ONLY component allowed to mutate AgentParams.
 *
 * Responsibilities:
 *   1. Re-validate every delta against hard bounds and the per-sleep budget
 *      (defense in depth — ReflectionEngine already clamps, we don't trust it).
 *   2. Append the EvolutionEvent (audit log) BEFORE touching params:
 *      event-without-params-change is a recoverable anomaly,
 *      params-change-without-event is an unauditable corruption.
 *   3. Apply the new params version / perform rollback via AgentParamsStore.
 *   4. Idempotency: event id is deterministic from runId; a re-run of a crashed
 *      sleep detects the existing event and skips re-applying.
 */

export interface EvolutionConfig {
  readonly maxTotalDelta: number;
  /** Shadow mode: emit events with dryRun=true, never touch params. */
  readonly dryRun: boolean;
}

export const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig = {
  maxTotalDelta: 0.1,
  dryRun: false,
};

export type EvolutionOutcome =
  | { readonly kind: 'applied'; readonly event: EvolutionEvent; readonly params: AgentParams }
  | { readonly kind: 'rolled_back'; readonly event: EvolutionEvent; readonly params: AgentParams }
  | { readonly kind: 'noop'; readonly event: EvolutionEvent }
  | { readonly kind: 'skipped_duplicate_run' };

export class InvalidDeltaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDeltaError';
  }
}

export class EvolutionEngine {
  constructor(
    private readonly paramsStore: AgentParamsStore,
    private readonly eventReader: AgentEventReader,
    private readonly clock: Clock,
    private readonly cfg: EvolutionConfig = DEFAULT_EVOLUTION_CONFIG,
  ) {}

  async evolve(
    agentId: string,
    runId: string,
    params: AgentParams,
    reflection: ReflectionResult,
    evidenceEventIds: readonly string[],
  ): Promise<EvolutionOutcome> {
    // Idempotency + redo (FIX 2.1): an existing event records INTENT, not
    // necessarily APPLICATION. A crash between audit-append and params-write
    // used to make the duplicate check return noop forever (frozen agent,
    // watermark advanced, evidence lost). If the recorded event says
    // fromVersion === live version, the intent never reached params — finish
    // the job (two-phase: event = redo log, deltas are self-contained).
    const existing = await this.eventReader.getEvolutionEventForRun(agentId, runId);
    if (existing !== null) {
      if (!existing.dryRun && params.version === existing.fromVersion) {
        if (existing.type === 'param_update') {
          const next = await this.paramsStore.commitNewVersion(
            agentId,
            existing.fromVersion,
            existing.deltas,
            existing.id,
          );
          return { kind: 'applied', event: existing, params: next };
        }
        if (existing.type === 'rollback') {
          const next = await this.paramsStore.rollbackTo(
            agentId,
            existing.fromVersion - 1,
            existing.fromVersion,
            existing.id,
          );
          return { kind: 'rolled_back', event: existing, params: next };
        }
      }
      return { kind: 'skipped_duplicate_run' };
    }

    if (reflection.rollbackRecommended && params.version > 0) {
      return this.rollback(agentId, runId, params, reflection, evidenceEventIds);
    }

    this.validateDeltas(params, reflection.deltas);

    if (reflection.deltas.length === 0) {
      const event = this.buildEvent(agentId, runId, 'noop', params.version, params.version, [], reflection, evidenceEventIds);
      await this.eventReader.appendEvolutionEvent(event);
      return { kind: 'noop', event };
    }

    const event = this.buildEvent(
      agentId,
      runId,
      'param_update',
      params.version,
      params.version + 1,
      reflection.deltas,
      reflection,
      evidenceEventIds,
    );

    // Audit log first, params second (see class doc).
    await this.eventReader.appendEvolutionEvent(event);

    if (this.cfg.dryRun) {
      return { kind: 'noop', event };
    }

    const next = await this.paramsStore.commitNewVersion(
      agentId,
      params.version,
      reflection.deltas,
      event.id,
    );
    return { kind: 'applied', event, params: next };
  }

  private async rollback(
    agentId: string,
    runId: string,
    params: AgentParams,
    reflection: ReflectionResult,
    evidenceEventIds: readonly string[],
  ): Promise<EvolutionOutcome> {
    const targetVersion = params.version - 1;
    const event = this.buildEvent(
      agentId,
      runId,
      'rollback',
      params.version,
      params.version + 1, // rollback is itself a new forward version
      [],
      reflection,
      evidenceEventIds,
    );
    await this.eventReader.appendEvolutionEvent(event);

    if (this.cfg.dryRun) {
      return { kind: 'noop', event };
    }

    const next = await this.paramsStore.rollbackTo(
      agentId,
      targetVersion,
      params.version,
      event.id,
    );
    return { kind: 'rolled_back', event, params: next };
  }

  /** Defense in depth: bounds + monotonic budget, independent of reflection. */
  private validateDeltas(params: AgentParams, deltas: readonly ParamDelta[]): void {
    let total = 0;
    for (const delta of deltas) {
      total += deltaMagnitude(delta);
      switch (delta.kind) {
        case 'confidenceBias':
          this.assertRange('confidenceBias', delta.to, PARAM_BOUNDS.confidenceBias);
          this.assertFrom('confidenceBias', delta.from, params.confidenceBias);
          break;
        case 'hedgingLevel':
          this.assertRange('hedgingLevel', delta.to, PARAM_BOUNDS.hedgingLevel);
          this.assertFrom('hedgingLevel', delta.from, params.hedgingLevel);
          break;
        case 'topicMultiplier': {
          this.assertRange(
            `topicMultiplier(${delta.topic})`,
            delta.to,
            PARAM_BOUNDS.topicMultiplier,
          );
          const current = params.topicCalibration[delta.topic]?.multiplier ?? 1.0;
          this.assertFrom(`topicMultiplier(${delta.topic})`, delta.from, current);
          break;
        }
      }
    }
    if (total > this.cfg.maxTotalDelta + 1e-9) {
      throw new InvalidDeltaError(
        `Total delta ${total.toFixed(4)} exceeds budget ${this.cfg.maxTotalDelta}`,
      );
    }
  }

  private assertRange(name: string, value: number, bounds: { min: number; max: number }): void {
    if (value < bounds.min || value > bounds.max || !Number.isFinite(value)) {
      throw new InvalidDeltaError(`${name}: ${value} out of [${bounds.min}, ${bounds.max}]`);
    }
  }

  /** delta.from must match live params — stale reflection ⇒ abort, not apply. */
  private assertFrom(name: string, declaredFrom: number, actual: number): void {
    if (Math.abs(declaredFrom - actual) > 1e-9) {
      throw new InvalidDeltaError(
        `${name}: delta.from=${declaredFrom} does not match current=${actual} (stale reflection)`,
      );
    }
  }

  private buildEvent(
    agentId: string,
    runId: string,
    type: EvolutionEvent['type'],
    fromVersion: number,
    toVersion: number,
    deltas: readonly ParamDelta[],
    reflection: ReflectionResult,
    evidenceEventIds: readonly string[],
  ): EvolutionEvent {
    return {
      id: `evo_${runId}`, // deterministic from runId → idempotent append
      agentId,
      runId,
      type,
      fromVersion,
      toVersion: type === 'noop' ? fromVersion : toVersion,
      deltas,
      diagnosis: reflection.diagnosis,
      evidence: {
        eventIds: evidenceEventIds,
        metrics: reflection.metrics,
      },
      dryRun: this.cfg.dryRun,
      ts: this.clock.nowIso(),
    };
  }
}
