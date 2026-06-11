/**
 * @moneyball/sleep-worker — public API surface + composition root example.
 */

export * from './memory/keys.js';
export * from './memory/MemWalClient.js';
export * from './params/AgentParams.js';
export * from './params/AgentParamsStore.js';
export * from './events/types.js';
export * from './reflection/metrics.js';
export * from './reflection/ReflectionEngine.js';
export * from './evolution/EvolutionEngine.js';
export * from './sleep/SleepState.js';
export * from './sleep/SleepLock.js';
export * from './sleep/SleepStateStore.js';
export * from './sleep/SleepWorker.js';

import { systemClock, type MemWalClient } from './memory/MemWalClient.js';
import { AgentParamsStore } from './params/AgentParamsStore.js';
import type { AgentEventReader } from './events/types.js';
import { ReflectionEngine } from './reflection/ReflectionEngine.js';
import { EvolutionEngine } from './evolution/EvolutionEngine.js';
import { SleepLock } from './sleep/SleepLock.js';
import { SleepStateStore } from './sleep/SleepStateStore.js';
import { SleepWorker } from './sleep/SleepWorker.js';

/**
 * Composition root. Both adapters are implemented in YOUR codebase:
 *   - memwal: wraps the MemWal client + MemWalWriteQueue (priorities, CAS)
 *   - eventReader: wraps AgentEventService (resolvedAt index + evolution append)
 *
 * `dryRun: true` = shadow mode for rollout (events emitted, params untouched).
 */
export function createSleepWorker(deps: {
  readonly memwal: MemWalClient;
  readonly eventReader: AgentEventReader;
  readonly dryRun?: boolean;
}): { readonly worker: SleepWorker; readonly paramsStore: AgentParamsStore; readonly stateStore: SleepStateStore } {
  const clock = systemClock;
  const paramsStore = new AgentParamsStore(deps.memwal, clock);
  const stateStore = new SleepStateStore(deps.memwal, clock);
  const reflection = new ReflectionEngine();
  const evolution = new EvolutionEngine(paramsStore, deps.eventReader, clock, {
    maxTotalDelta: reflection.config.maxTotalDelta,
    dryRun: deps.dryRun ?? false,
  });
  const worker = new SleepWorker({
    stateStore,
    lock: new SleepLock(deps.memwal, clock),
    eventReader: deps.eventReader,
    paramsStore,
    reflection,
    evolution,
    clock,
  });
  return { worker, paramsStore, stateStore };
}
