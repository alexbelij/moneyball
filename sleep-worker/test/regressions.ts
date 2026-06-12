/**
 * regressions | v1.0.0 | 2026-06-12
 * Purpose: Regression tests for the 4 REPRO-CONFIRMED bugs from the red-team
 * architecture review. Each test reproduces the original failure scenario and
 * asserts the fixed behaviour.
 *
 *   R1 (2.1) crash between audit-append and params-write → redo, not freeze
 *   R2 (1.1) outcome-resolution path must never touch sleep_state (watermark)
 *   R3 (2.2) identical resolvedAt at page boundary → composite cursor, no loss
 *   R4 (3.1) rollback v1→v0 works (genesis snapshot + deterministic fallback)
 *
 * Run: bun test/regressions.ts
 */

import {
  MemWalKeys,
  createSleepWorker,
  type PredictionEvent,
} from '../src/index.js';
import { FakeMemWal, FakeEventReader, assert } from './fakes.js';

function makeResolved(
  agentId: string,
  n: number,
  opts: { resolvedAt?: string; correct?: boolean; topic?: string } = {},
): PredictionEvent {
  const ts = opts.resolvedAt ?? new Date(Date.UTC(2026, 5, 1, 0, n)).toISOString();
  return {
    id: `pred_${String(n).padStart(4, '0')}`,
    agentId,
    userId: `user_${n % 5}`,
    topic: opts.topic ?? 'wc_group_stage',
    prediction: `pick ${n}`,
    rawConfidence: 0.85,
    effectiveConfidence: 0.85,
    paramsVersion: 0,
    outcome: { correct: opts.correct ?? n % 3 === 0, resolvedAt: ts },
    disagree: null,
    ts,
  };
}

async function ageLastSleep(memwal: FakeMemWal, agentId: string): Promise<void> {
  const key = MemWalKeys.sleepState(agentId);
  const rec = await memwal.read<Record<string, unknown>>(key);
  if (rec === null) return;
  await memwal.write(
    key,
    { ...rec.value, lastSleepAt: new Date(Date.now() - 2 * 3600_000).toISOString() },
    { priority: 'HIGH', ifVersion: rec.memwalVersion, awaitDurability: true },
  );
}

// ── R1: crash between audit-append and params-write ─────────────────────────
async function testRedoAfterCrash(): Promise<void> {
  console.log('R1 (bug 2.1): crash between audit-append and params-write');
  const AGENT = 'r1_agent';
  const memwal = new FakeMemWal();
  const reader = new FakeEventReader();
  const { worker, paramsStore, stateStore } = createSleepWorker({ memwal, eventReader: reader });

  await paramsStore.getOrCreate(AGENT);
  for (let i = 0; i < 60; i++) reader.predictions.push(makeResolved(AGENT, i, { correct: false }));
  for (let i = 0; i < 60; i++) await stateStore.recordOutcomeResolved(AGENT);

  // Inject crash exactly between appendEvolutionEvent and commitNewVersion:
  // the next write to the live personality pointer fails once.
  memwal.failNextWriteMatching = (key) => key === MemWalKeys.personality(AGENT);
  const r1 = await worker.runIfDue(AGENT);
  assert(r1.kind === 'aborted', `run 1 aborted by injected crash (got ${r1.kind})`);
  assert(reader.evolutions.length === 1, 'audit event was appended before the crash');
  const live1 = await paramsStore.getOrCreate(AGENT);
  assert(live1.version === 0, 'params still v0 after crash (intent recorded, not applied)');

  // Retry with the same watermark → same runId. OLD behaviour: noop forever.
  const r2 = await worker.runIfDue(AGENT);
  const live2 = await paramsStore.getOrCreate(AGENT);
  assert(r2.kind === 'evolved', `retry re-applies the recorded intent (got ${r2.kind})`);
  assert(live2.version === 1, 'live params reached v1 (redo log executed)');
  assert(reader.evolutions.length === 1, 'no duplicate evolution event on redo');
}

// ── R2: interaction path must never write sleep_state ───────────────────────
async function testWatermarkNotRegressed(): Promise<void> {
  console.log('R2 (bug 1.1): resolution path is isolated from sleep_state');
  const AGENT = 'r2_agent';
  const memwal = new FakeMemWal();
  const reader = new FakeEventReader();
  const { worker, paramsStore, stateStore } = createSleepWorker({ memwal, eventReader: reader });

  await paramsStore.getOrCreate(AGENT);
  for (let i = 0; i < 60; i++) reader.predictions.push(makeResolved(AGENT, i));
  for (let i = 0; i < 60; i++) await stateStore.recordOutcomeResolved(AGENT);

  const r1 = await worker.runIfDue(AGENT);
  assert(r1.kind !== 'not_due' && r1.kind !== 'lock_busy', `sleep #1 ran (${r1.kind})`);
  const stateAfterCommit = await memwal.read<{ resolvedWatermark: unknown }>(
    MemWalKeys.sleepState(AGENT),
  );
  const watermarkAfterCommit = JSON.stringify(stateAfterCommit?.value.resolvedWatermark);

  // The old bug: a concurrent recordOutcomeResolved (read-before-commit,
  // write-after-commit) rewrote the WHOLE sleep_state doc and regressed the
  // watermark. Now it only touches resolved_counter — sleep_state must be
  // byte-identical after any number of increments.
  const stateDocVersionBefore = stateAfterCommit?.memwalVersion;
  for (let i = 0; i < 25; i++) await stateStore.recordOutcomeResolved(AGENT);
  const stateAfter = await memwal.read<{ resolvedWatermark: unknown }>(
    MemWalKeys.sleepState(AGENT),
  );
  assert(
    stateAfter?.memwalVersion === stateDocVersionBefore,
    'sleep_state doc untouched by 25 concurrent outcome resolutions',
  );
  assert(
    JSON.stringify(stateAfter?.value.resolvedWatermark) === watermarkAfterCommit,
    'watermark did not regress',
  );
  const composed = await stateStore.get(AGENT);
  assert(composed.resolvedSinceSleep === 25, 'derived trigger counter = 25');
}

// ── R3: identical resolvedAt at a page boundary ─────────────────────────────
async function testCompositeCursorNoLoss(): Promise<void> {
  console.log('R3 (bug 2.2): batch-resolved events with identical resolvedAt');
  const AGENT = 'r3_agent';
  const memwal = new FakeMemWal();
  const reader = new FakeEventReader();
  const { worker, paramsStore, stateStore } = createSleepWorker({
    memwal,
    eventReader: reader,
    config: { collectLimit: 5, minResolvedToSleep: 5, minMinutesBetweenSleeps: 0 },
  });

  await paramsStore.getOrCreate(AGENT);
  // One final whistle: 10 predictions, ONE resolvedAt.
  const whistle = '2026-06-12T18:00:00.000Z';
  for (let i = 0; i < 10; i++) {
    reader.predictions.push(makeResolved(AGENT, i, { resolvedAt: whistle }));
  }
  for (let i = 0; i < 10; i++) await stateStore.recordOutcomeResolved(AGENT);

  const r1 = await worker.runIfDue(AGENT);
  assert(r1.kind !== 'not_due' && r1.kind !== 'lock_busy', `sleep #1 ran (${r1.kind})`);
  const s1 = await stateStore.get(AGENT);
  assert(
    s1.resolvedWatermark !== null && s1.resolvedWatermark.eventId === 'pred_0004',
    'watermark carries (resolvedAt, eventId) of the page tail',
  );

  // OLD behaviour: second COLLECT with `resolvedAt > whistle` returns 0 —
  // 5 events lost forever. Composite cursor must return exactly the tail 5.
  const page2 = await reader.listResolvedSince(AGENT, s1.resolvedWatermark, 5);
  assert(page2.length === 5, `second page returns the remaining 5 events (got ${page2.length})`);
  assert(page2[0]?.id === 'pred_0005', 'second page starts right after the cursor');

  await ageLastSleep(memwal, AGENT);
  const r2 = await worker.runIfDue(AGENT);
  assert(r2.kind !== 'not_due' && r2.kind !== 'lock_busy', `sleep #2 processes the tail (${r2.kind})`);
  const s2 = await stateStore.get(AGENT);
  assert(
    s2.resolvedWatermark !== null && s2.resolvedWatermark.eventId === 'pred_0009',
    'watermark advanced through the full identical-timestamp group',
  );
}

// ── R4: rollback v1 → v0 ─────────────────────────────────────────────────────
async function testRollbackToGenesis(): Promise<void> {
  console.log('R4 (bug 3.1): rollback to v0 (snapshot + deterministic fallback)');
  const AGENT = 'r4_agent';
  const memwal = new FakeMemWal();
  const reader = new FakeEventReader();
  const { paramsStore } = createSleepWorker({ memwal, eventReader: reader });

  const v0 = await paramsStore.getOrCreate(AGENT);
  const snap0 = await memwal.read(MemWalKeys.personalityHistory(AGENT, 0));
  assert(snap0 !== null, 'genesis snapshot personality_history/0 exists after getOrCreate');

  const v1 = await paramsStore.commitNewVersion(
    AGENT,
    0,
    [{ kind: 'confidenceBias', from: 0, to: -0.05 }],
    'evo_test_run',
  );
  assert(v1.version === 1, 'evolved to v1');

  // OLD behaviour: throws "No history snapshot v0" → eternal abort loop.
  const v2 = await paramsStore.rollbackTo(AGENT, 0, 1, 'evo_rollback_run');
  assert(v2.version === 2, 'rollback lands as forward version v2');
  assert(v2.confidenceBias === v0.confidenceBias, 'v2 content equals genesis params');

  // Fallback path: simulate a pre-fix agent with no genesis snapshot.
  memwal.store.delete(MemWalKeys.personalityHistory(AGENT, 0));
  const v3 = await paramsStore.commitNewVersion(
    AGENT,
    2,
    [{ kind: 'confidenceBias', from: 0, to: -0.08 }],
    'evo_test_run_2',
  );
  const v4 = await paramsStore.rollbackTo(AGENT, 0, v3.version, 'evo_rollback_run_2');
  assert(v4.confidenceBias === 0, 'missing snapshot: v0 reconstructed from defaultParams()');
}

async function main(): Promise<void> {
  await testRedoAfterCrash();
  await testWatermarkNotRegressed();
  await testCompositeCursorNoLoss();
  await testRollbackToGenesis();
  console.log('\nALL 4 REGRESSION SUITES PASSED');
}

void main().then(undefined, (err) => {
  console.error(err);
  process.exit(1);
});
