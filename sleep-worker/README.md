# @moneyball/sleep-worker — MVP SleepWorker on MemWal

Agent self-learning **without LLM, without embeddings — pure TypeScript, pure MemWal**.
Compiles under `tsc --strict` (+ `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
E2E simulation (`test/simulation.ts`) proves real evolution: v0 → v1 → v2,
overconfidence bias goes negative, weak topic gets multiplier < 1, cooldown works.

## File Structure

```
sleep-worker/
├── package.json
├── tsconfig.json                  # strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes
├── src/
│   ├── index.ts                   # public API + createSleepWorker() (composition root)
│   ├── memory/
│   │   ├── keys.ts                # SINGLE source of truth for MemWal key construction
│   │   └── MemWalClient.ts        # port over MemWal: read / write(CAS, priority) / listKeys + Clock
│   ├── params/
│   │   ├── AgentParams.ts         # AgentParams, PARAM_BOUNDS, ParamDelta (discriminated union),
│   │   │                          # applyCalibration() — inference-side helper
│   │   └── AgentParamsStore.ts    # versioned store: getCached(30s) / getOrCreate /
│   │                              # commitNewVersion(CAS) / rollbackTo / history prune
│   ├── events/
│   │   └── types.ts               # PredictionEvent (target schema), EvolutionEvent,
│   │                              # AgentEventReader — port over AgentEventService
│   ├── reflection/
│   │   ├── metrics.ts             # pure functions: Brier, calibration buckets, gap,
│   │   │                          # per-topic/per-version stats, capped disagree rate
│   │   └── ReflectionEngine.ts    # deterministic deltas + shadow-eval → rollback
│   ├── evolution/
│   │   └── EvolutionEngine.ts     # SOLE params mutator: validation, audit-first,
│   │                              # idempotency by runId, dryRun (shadow mode)
│   └── sleep/
│       ├── SleepState.ts          # SleepState, SleepCheckpoint, SleepRunResult, SleepLockRecord
│       ├── SleepStateStore.ts     # counters (lossy NORMAL) + COMMIT/abort/checkpoint (HIGH)
│       ├── SleepLock.ts           # CAS-lock with 10 min TTL, stale lock theft via CAS
│       └── SleepWorker.ts         # orchestrator: trigger → LOCK → COLLECT → REFLECT → EVOLVE → COMMIT
└── test/
    └── simulation.ts              # e2e: FakeMemWal (CAS-correct) + FakeEventReader
```

## Key Invariants (enforced in code)

1. **Single mutable surface** — `AgentParams`. Changed only via
   `EvolutionEngine` → `AgentParamsStore.commitNewVersion()` with CAS on `memwalVersion`
   and logical `version`.
2. **Audit-first**: `EvolutionEvent` is written BEFORE params change. An event without
   a change is a recoverable anomaly; a change without an event is unauditable corruption.
3. **History-before-pointer**: a snapshot of the new version at `personality_history/{v}` is written
   before switching the live pointer — a crash between writes doesn't lose the version.
4. **Watermark by `outcome.resolvedAt`**, not by event `ts` — late-resolving
   predictions are never lost.
5. **Signal separation**: outcomes → calibration; disagree → hedging only
   (+ 20% weight cap per userId — anti-manipulation).
6. **Idempotency**: `runId = agentId:watermark:paramsVersion` is deterministic;
   `EvolutionEvent.id = evo_{runId}`; re-running a failed sleep never applies twice.
7. **`delta.from` must match live params** — stale reflection fails rather than applies.
8. **Change budget**: Σ|delta| ≤ 0.10 per sleep + 2-sleep cooldown per topic + boundary clamps
   checked twice (Reflection clamps, Evolution re-validates — defense in depth).
9. **Shadow rollback**: Brier(vN) > Brier(vN−1) + 0.05 with n≥15 on both versions →
   rollback (as a new forward version, history is never rewritten).

## Required Adapters (2 ports to implement)

```ts
const { worker, paramsStore } = createSleepWorker({ memwal, eventReader, dryRun: true });
```

- `MemWalClient` — wrapper over your MemWal access + `MemWalWriteQueue`.
- `AgentEventReader` — wrapper over `AgentEventService`.

## Migration Path from AgentEventService

**Step 0 (day 0, no behavioral changes).**
Extend `PredictionEvent`: add `paramsVersion` (backfill `0` for old events),
`rawConfidence`/`effectiveConfidence` (backfill = current `confidence`). Outcome resolver
starts writing `outcome.resolvedAt`.

**Step 1. Index by resolvedAt.**
`AgentEventReader.listResolvedSince()` needs a query "outcome.resolvedAt > X, order asc".
If MemWal doesn't support such a scan — maintain a compact index document
`agent/{id}/sys/resolved_index` (append id on resolve, same write path as outcome).

**Step 2. MemWalWriteQueue: priorities + CAS.**
Add `priority: HIGH | NORMAL | LOW_LOSSY` (HIGH is never coalesced or dropped;
LOW_LOSSY is dropped first during 429 storms) and `awaitDurability` (HIGH writes wait
for confirmation). If MemWal lacks native CAS — emulate with read-verify-write;
this is safe because sleep jobs are partitioned by agentId to a single consumer,
and SleepLock provides a second line of defense.

**Step 3. AgentParamsStore in inference path (behind a flag).**
Where the agent forms confidence: `applyCalibration(await paramsStore.getCached(agentId), topic, raw)`.
With params v0 this is identity (bias 0, multiplier 1.0) — behavior doesn't change.
Write `paramsVersion` and `effectiveConfidence` into every new PredictionEvent.

**Step 4. Outcome resolver fires counter.**
After writing outcome: `stateStore.recordOutcomeResolved(agentId)` (NORMAL, fire-and-forget).

**Step 5. SleepWorker in shadow mode.**
Deploy the consumer (`dryRun: true`): cron/queue calls `worker.runIfDue(agentId)`.
Observe EvolutionEvents with `dryRun: true` for a week — what deltas the agent "would like" to apply.

**Step 6. Enable on a pilot agent.**
`dryRun: false` for one agent. Metrics: Brier by `paramsVersion` (already in evidence
of each EvolutionEvent), rollback frequency, `consecutiveAborts`. Alerts: no sleep in 48h;
3 consecutive aborts; 2 consecutive rollbacks (= unstable reflection, freeze the agent).

**Step 7. Full rollout + decommission requires nothing** — old PredictionEvent fields
are not removed, AgentEventService remains the source of truth for events.

## Default Configuration

| Parameter | Value | Location |
|---|---|---|
| learningRate | 0.15 | ReflectionConfig |
| minSamples (global/topic) | 20 / 20 | ReflectionConfig |
| calibrationGapThreshold | 0.05 | ReflectionConfig |
| maxTotalDelta per sleep | 0.10 | Reflection + Evolution |
| topicCooldownSleeps | 2 | ReflectionConfig |
| rollback: excess / minSamples | 0.05 / 15 | ReflectionConfig |
| Sleep trigger | 50 resolved OR 24h with ≥10 | SleepWorkerConfig |
| Min interval between sleeps | 60 min | SleepWorkerConfig |
| collectLimit (window) | 500 | SleepWorkerConfig |
| Lock TTL | 10 min | SleepLock |
| Params cache TTL / history | 30s / 10 versions | AgentParamsStoreConfig |

## Commands

```bash
pnpm install
pnpm exec tsc --noEmit   # typecheck (passes clean)
pnpm exec tsx test/simulation.ts  # e2e evolution simulation
```
