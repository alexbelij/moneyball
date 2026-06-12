/**
 * End-to-end simulation: in-memory MemWal + fake AgentEventService.
 * Proves: an overconfident agent accumulates PredictionEvent+outcome,
 * sleeps, and measurably evolves (bias goes negative, version increments,
 * weak topic gets a multiplier < 1, cooldowns arm).
 *
 * Run: bun test/simulation.ts
 */

import { applyCalibration, createSleepWorker, systemClock } from '../src/index.js';
import { FakeMemWal, FakeEventReader } from './fakes.js';

// ── Scenario ─────────────────────────────────────────────────────────────────
const AGENT = 'agent_001';
const memwal = new FakeMemWal();
const reader = new FakeEventReader();
const { worker, paramsStore, stateStore } = createSleepWorker({ memwal, eventReader: reader });

// Deterministic RNG so the test is reproducible.
let seed = 42;
const rand = (): number => {
  seed = (seed * 1103515245 + 12345) % 2 ** 31;
  return seed / 2 ** 31;
};

function makeBatch(startIndex: number, count: number, paramsVersion: number, biasApplied: number): void {
  for (let i = 0; i < count; i++) {
    const n = startIndex + i;
    const topic = n % 3 === 0 ? 'nba_b2b' : 'nba_regular'; // b2b = the weak topic
    const raw = 0.7 + rand() * 0.25; // agent claims 70–95%
    const effective = Math.min(0.99, Math.max(0.01, raw + biasApplied));
    // True hit rates are far below the claimed confidence (overconfident agent):
    const trueP = topic === 'nba_b2b' ? 0.35 : 0.55;
    const correct = rand() < trueP;
    const ts = new Date(Date.UTC(2026, 5, 1, 0, n)).toISOString();
    reader.predictions.push({
      id: `pred_${n}`,
      agentId: AGENT,
      userId: `user_${n % 7}`,
      topic,
      prediction: `pick ${n}`,
      rawConfidence: raw,
      effectiveConfidence: effective,
      paramsVersion,
      outcome: { correct, resolvedAt: ts },
      disagree: rand() < 0.15 ? { userId: `user_${n % 7}`, ts } : null,
      ts,
    });
  }
}

async function main(): Promise<void> {
  const v0 = await paramsStore.getOrCreate(AGENT);
  console.log('v0:', { version: v0.version, bias: v0.confidenceBias });

  // Cycle 1: 60 resolved predictions on params v0
  makeBatch(0, 60, 0, 0);
  for (let i = 0; i < 60; i++) await stateStore.recordOutcomeResolved(AGENT);

  const r1 = await worker.runIfDue(AGENT);
  const p1 = await paramsStore.getOrCreate(AGENT);
  console.log('sleep #1:', r1);
  console.log('params v1:', {
    version: p1.version,
    bias: p1.confidenceBias.toFixed(3),
    topics: p1.topicCalibration,
  });
  console.log('calibrated 0.85 on nba_b2b:', applyCalibration(p1, 'nba_b2b', 0.85).toFixed(3));

  // Immediate re-run: must be blocked by the 60-minute floor / counters.
  console.log('immediate re-run:', await worker.runIfDue(AGENT));

  // Cycle 2: bypass the time floor by aging lastSleepAt (test-only surgery).
  const stateKey = `agent/${AGENT}/sys/sleep_state`;
  const st = await memwal.read<Record<string, unknown>>(stateKey);
  await memwal.write(
    stateKey,
    { ...st!.value, lastSleepAt: new Date(Date.now() - 2 * 3600_000).toISOString() },
    { priority: 'HIGH', awaitDurability: true },
  );

  makeBatch(60, 60, p1.version, p1.confidenceBias);
  for (let i = 0; i < 60; i++) await stateStore.recordOutcomeResolved(AGENT);

  const r2 = await worker.runIfDue(AGENT);
  const p2 = await paramsStore.getOrCreate(AGENT);
  console.log('sleep #2:', r2);
  console.log('params v2:', {
    version: p2.version,
    bias: p2.confidenceBias.toFixed(3),
    topics: p2.topicCalibration,
  });

  console.log('\nEvolution log:');
  for (const e of reader.evolutions) {
    console.log(` [${e.type}] v${e.fromVersion}→v${e.toVersion} :: ${e.diagnosis}`);
  }

  // Assertions
  const assert = (cond: boolean, msg: string): void => {
    if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
    console.log(`✓ ${msg}`);
  };
  console.log('');
  assert(p1.version === 1 && p2.version === 2, 'agent evolved twice (v0→v1→v2)');
  assert(p2.confidenceBias < 0, 'overconfidence corrected: bias < 0');
  assert(
    (p2.topicCalibration['nba_b2b']?.multiplier ?? 1) < 1,
    'weak topic nba_b2b got multiplier < 1',
  );
  assert(reader.evolutions.every((e) => !e.dryRun), 'live mode events');
  assert(
    applyCalibration(p2, 'nba_b2b', 0.85) < 0.85,
    'inference-side confidence is now lower on the weak topic',
  );
  console.log('\nSIMULATION PASSED — agent really evolves.');
}

void main().then(undefined, (err) => {
  console.error(err);
  process.exit(1);
});

// silence unused import in case of refactor
void systemClock;
