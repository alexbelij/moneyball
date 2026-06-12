/**
 * sleepService | v0.1.0 | 2026-06-12
 * Purpose: Composition root for the self-learning loop. One shared KV client,
 * one shared event reader, one SleepWorker; runIfDue is invoked after match
 * resolutions (and from an admin endpoint) — no cron, no busy loop.
 */

import {
  applyCalibration,
  createSleepWorker,
  type AgentParams,
  type SleepRunResult,
} from '@moneyball/sleep-worker'
import { env } from '../config/env'
import { AgentEventService } from './agentEventService'
import { BackendEventReader, KvMemWalClient } from './sleepAdapters'

export class SleepService {
  readonly reader: BackendEventReader
  private readonly worker
  private readonly paramsStore
  private readonly stateStore

  constructor(publicEvents: AgentEventService) {
    this.reader = new BackendEventReader(publicEvents)
    const { worker, paramsStore, stateStore } = createSleepWorker({
      memwal: new KvMemWalClient(),
      eventReader: this.reader,
      config: {
        minResolvedToSleep: env.SLEEP_MIN_RESOLVED,
        minMinutesBetweenSleeps: env.SLEEP_MIN_MINUTES,
        // WC pace: ~4 matches/day ⇒ a few resolved events per agent per day.
        minResolvedForTimeTrigger: 1,
      },
    })
    this.worker = worker
    this.paramsStore = paramsStore
    this.stateStore = stateStore
  }

  async getParams(agentId: string): Promise<AgentParams> {
    return this.paramsStore.getOrCreate(agentId)
  }

  /** Raw → effective confidence using the agent's current calibration. */
  async calibrate(agentId: string, topic: string, rawConfidence: number): Promise<number> {
    const params = await this.paramsStore.getOrCreate(agentId)
    return applyCalibration(params, topic, rawConfidence)
  }

  /** Notify the trigger counter that one outcome resolved for this agent. */
  async onOutcomeResolved(agentId: string): Promise<void> {
    await this.stateStore.recordOutcomeResolved(agentId)
  }

  /** Run the sleep pipeline if due. Returns the outcome for logging/UI. */
  async runIfDue(agentId: string): Promise<SleepRunResult> {
    try {
      return await this.worker.runIfDue(agentId)
    } catch (err) {
      console.error('[sleep.error]', agentId, err)
      return { kind: 'aborted', runId: 'unhandled', error: String(err) }
    }
  }
}
