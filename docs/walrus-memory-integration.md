<!-- walrus-memory-integration.md | v1.0.0 | 2026-06-17 -->

# Walrus Memory Integration — Technical Reference

> How Moneyball uses MemWal SDK v0.0.7 to persist agent state, predictions,
> evolution history, and user profiles on Walrus mainnet — with zero external
> databases.

---

## Table of Contents

1. [Overview](#1-overview)
2. [SDK Configuration](#2-sdk-configuration)
3. [Namespace Strategy](#3-namespace-strategy)
4. [Write Path — MemWalWriteQueue](#4-write-path--memwalwritequeue)
5. [Read Path — Materialized Read-Model](#5-read-path--materialized-read-model)
6. [Key-Value Overlay — KvMemWalClient](#6-key-value-overlay--kvmemwalclient)
7. [User Memory — MemWalUserSummaryStore](#7-user-memory--memwalusersummarystore)
8. [Boot Hydration — restore() + recall()](#8-boot-hydration--restore--recall)
9. [Sleep-Worker Memory Adapters](#9-sleep-worker-memory-adapters)
10. [Rate Limiting & Retry Strategy](#10-rate-limiting--retry-strategy)
11. [Lessons Learned & SDK Feedback](#11-lessons-learned--sdk-feedback)

---

## 1. Overview

Moneyball treats MemWal as the **sole durable store**. There is no PostgreSQL,
Redis, or any other database. All persistent state flows through the MemWal
relayer to Walrus mainnet blobs:

```
Agent predictions  ──┐
Agent evolution    ──┤
Agent parameters   ──┼──▶  MemWalWriteQueue  ──▶  MemWal relayer  ──▶  Walrus blobs
User summaries     ──┤
User disagrees     ──┘
```

On the read side, the backend maintains an in-memory materialized view
(`AgentEventService`) that is populated on every write and rehydrated from
MemWal on cold boot. This architecture gives us:

- **Append-only auditability** — every prediction and parameter change is
  immutable on Walrus.
- **Crash resilience** — the read-model rebuilds from MemWal if local state is
  lost (Render's ephemeral disk wipes on every deploy).
- **Judge-verifiable** — anyone can `recall()` from the same namespace and see
  the raw agent history.

---

## 2. SDK Configuration

```typescript
// apps/backend/src/config/env.ts
import { MemWal } from '@mysten-incubation/memwal';

const memwal = MemWal.create({
  key: process.env.MEMWAL_KEY,           // Ed25519 delegate key (base64)
  accountId: process.env.MEMWAL_ACCOUNT_ID,
  serverUrl: process.env.MEMWAL_RELAYER, // https://relayer.memwal.ai
  namespace: process.env.MEMWAL_NAMESPACE,
});
```

| Variable | Purpose |
|----------|---------|
| `MEMWAL_KEY` | Ed25519 delegate key for signing requests |
| `MEMWAL_ACCOUNT_ID` | Account identifier on the relayer |
| `MEMWAL_RELAYER` | Relayer endpoint (`https://relayer.memwal.ai`) |
| `MEMWAL_NAMESPACE` | Default namespace for all writes |

The SDK handles SEAL `SessionKey` generation (5-minute TTL, auto-cached) and
blob encryption transparently.

---

## 3. Namespace Strategy

All Moneyball data lives in a single namespace (`moneyball:prod`). Records are
distinguished by text-encoded prefixes:

| Prefix | Data Type | Example |
|--------|-----------|---------|
| `moneyball:prediction` | Agent predictions | `moneyball:prediction match=GER-SCO agent=dr_morgan ...` |
| `moneyball:outcome` | Match outcomes | `moneyball:outcome match=GER-SCO correct=true ...` |
| `moneyball:evolution` | Parameter changes | `moneyball:evolution agent=dr_morgan version=5 ...` |
| `moneyball:sys_kv` | Agent params (KV) | `moneyball:sys_kv key=params:dr_morgan seq=12 ...` |
| `moneyball:user_summary` | User profiles | `moneyball:user_summary userId=0x8a71... ...` |

**Why single namespace:** MemWal's `recall()` is scoped to one namespace per
call. Cross-namespace queries require multiple round-trips. Since all our data
is semantically related (World Cup predictions), a single namespace with
text-prefix filtering gives us the best recall quality.

---

## 4. Write Path — MemWalWriteQueue

**File:** `apps/backend/src/memory/memwalWriteQueue.ts`

The MemWal relayer enforces rate limits (429 responses with
`retry_after_seconds`). We built `MemWalWriteQueue` to handle this:

```typescript
export class MemWalWriteQueue {
  constructor(
    remember: (text: string) => Promise<void>,
    opts: { debounceMs: number; minIntervalMs: number }
  )

  enqueue(key: string, text: string): void
}
```

### How it works

1. **Key-based coalescing** — if the same key is enqueued multiple times before
   the debounce window expires, only the latest value is written. This prevents
   redundant writes when agent parameters update rapidly during a sleep cycle.

2. **Minimum interval** — enforces at least `minIntervalMs` (default 1200ms)
   between consecutive `remember()` calls to stay under rate limits.

3. **Exponential backoff with server hints** — on 429 errors, the queue reads
   `retry_after_seconds` from the error response and backs off accordingly.
   For other errors, standard exponential backoff (capped at 60s).

4. **Non-blocking** — `enqueue()` returns immediately. The queue processes
   writes in a background loop.

### Production configuration

```typescript
const queue = new MemWalWriteQueue(
  (text) => memwal.remember(text),
  { debounceMs: 1500, minIntervalMs: 1200 }
);
```

These values were determined through production testing against the relayer.
The MemWal SDK does not document rate limits (we filed
[#296](https://github.com/MystenLabs/MemWal/issues/296) for this).

---

## 5. Read Path — Materialized Read-Model

**File:** `apps/backend/src/agents/agentEventService.ts`

MemWal's `recall()` is semantic search — fast for "find memories about X" but
not ideal for "list all predictions by agent dr_morgan sorted by date." We
maintain a deterministic in-memory index as a read-model:

```
┌──────────────┐    every write    ┌────────────────┐
│ MemWal Write │ ──────────────▶  │ In-Memory Index │
│   Queue      │                  │ (Map by agentId)│
└──────────────┘                  └────────────────┘
       │                                  │
       ▼                                  ▼
  Walrus blobs                    GET /api/public/agents/:id/*
  (durable)                       (fast, deterministic)
```

### Index structure

```typescript
// Per-agent indexed data
{
  predictions: Map<string, AgentPredictionEvent>,   // key: predictionId
  outcomes: Map<string, AgentOutcomeEvent>,         // key: predictionId
  evolutions: AgentEvolutionEvent[],                // chronological
}
```

### Persistence

The index is serialized to `.data/agent-index.json` (debounced, every 5s after
a mutation). On Render's ephemeral disk, this file is lost on every deploy.

### Boot hydration

On cold start, the service:
1. Loads `.data/agent-index.json` if it exists (fast path).
2. Calls `memwal.restore(namespace, 100)` to re-index any blobs not in the
   local snapshot.
3. Calls `memwal.recall()` with topic-specific queries to fill gaps.
4. Merges without duplicates (idempotent by event ID).

---

## 6. Key-Value Overlay — KvMemWalClient

**File:** `sleep-worker/src/memory/MemWalClient.ts`

MemWal is append-only and semantic. To store versioned agent parameters (which
need exact-key lookup and CAS semantics), we built a KV overlay:

```typescript
interface KvMemWalClient {
  get(key: string): Promise<string | null>
  put(key: string, value: string, seq: number): Promise<void>
}
```

### How it works

1. **Write:** `put("params:dr_morgan", json, seq=5)` →
   `memwal.remember("moneyball:sys_kv key=params:dr_morgan seq=5\n{...}")`

2. **Read:** `get("params:dr_morgan")` →
   `memwal.recall("moneyball:sys_kv key=params:dr_morgan")` → parse the
   highest-seq result.

3. **CAS guard:** The `seq` field provides compare-and-swap semantics. The
   `EvolutionEngine` reads the current seq, increments, and writes. If two
   concurrent writers race, the higher seq wins on read.

This pattern works but is fragile — semantic search for an exact key can return
near-matches. We filed [#289](https://github.com/MystenLabs/MemWal/issues/289)
requesting native key-based recall.

---

## 7. User Memory — MemWalUserSummaryStore

**File:** `apps/backend/src/memory/memwalUserSummaryStore.ts`

Each visitor who connects a Sui wallet gets a persistent user summary stored in
MemWal. The summary tracks:

```typescript
interface UserSummary {
  walletAddress: string
  firstSeenAt: string
  lastSeenAt: string
  totalDisagrees: number
  disagreeHistory: Array<{
    agentId: string
    matchId: string
    reason: string
    timestamp: string
  }>
  interactionMilestones: string[]
}
```

### Caching

- **Local cache TTL:** 30 seconds. Prevents redundant `recall()` calls for the
  same user within a session.
- **Write coalescing:** Uses `MemWalWriteQueue` with user-specific keys.
  Multiple disagrees in quick succession are batched into a single write.

### Store factory

`storeFactory.ts` selects the storage backend at startup:

```typescript
if (env.STORAGE_BACKEND === 'memwal' && env.MEMWAL_KEY) {
  return new MemWalUserSummaryStore()   // production: Walrus mainnet
} else {
  return new FileUserSummaryStore()     // dev: local .data/ JSON files
}
```

---

## 8. Boot Hydration — restore() + recall()

When the backend starts cold (Render redeploy, crash recovery), it rebuilds
state from MemWal:

```
Cold start
  │
  ├─▶ restore(namespace, 100)     // re-index up to 100 most recent blobs
  │
  ├─▶ recall("prediction")        // semantic search for predictions
  ├─▶ recall("evolution")         // semantic search for evolutions
  ├─▶ recall("outcome")           // semantic search for outcomes
  │
  └─▶ Merge into in-memory index (deduplicate by event ID)
```

### Limitations

- `restore()` has no pagination cursor — we can only inspect the N most recent
  blobs. Filed [#289](https://github.com/MystenLabs/MemWal/issues/289).
- Semantic recall may miss records whose text doesn't match the query well.
  The seed fixture (`scripts/seed-demo.ts`) provides a known baseline that
  guarantees the index is populated for demo scenarios.

---

## 9. Sleep-Worker Memory Adapters

The sleep-worker package (`sleep-worker/`) is a pure TypeScript library with no
direct MemWal dependency. It communicates through adapter interfaces:

```typescript
// AgentParamsStore — read/write versioned agent parameters
interface AgentParamsStore {
  load(agentId: string): Promise<AgentParams | null>
  save(agentId: string, params: AgentParams): Promise<void>
}

// AgentEventReader — read prediction outcomes for reflection
interface AgentEventReader {
  listResolved(agentId: string, cursor: ResolvedCursor): Promise<PredictionEvent[]>
}
```

The backend provides concrete implementations that delegate to
`AgentEventService` (which writes through to MemWal). This keeps the
reflection/evolution math isolated from network concerns.

### Sleep cycle flow

```
SleepWorker.run(agentId)
  │
  ├─▶ COLLECT: AgentEventReader.listResolved() → resolved predictions
  ├─▶ REFLECT: ReflectionEngine.reflect() → ParamDelta[] (pure math)
  ├─▶ EVOLVE:  EvolutionEngine.apply() → new AgentParams (CAS versioned)
  └─▶ COMMIT:  AgentParamsStore.save() → MemWal write (via queue)
```

Every step is deterministic and LLM-free. The evolution audit trail
(EvolutionEvent) is also persisted to MemWal, creating a verifiable chain from
raw outcomes to parameter changes.

---

## 10. Rate Limiting & Retry Strategy

MemWal's relayer rate limits are undocumented. Through production testing we
established:

| Observation | Value |
|-------------|-------|
| Rate limit response | HTTP 429 with `{ retry_after_seconds: N }` in body |
| Safe write interval | ≥ 1200ms between `remember()` calls |
| Debounce window | 1500ms (coalesces rapid writes to same key) |
| Max retry backoff | 60 seconds (exponential, capped) |
| `rememberBulk()` max items | 20 (discovered by trial) |
| SEAL SessionKey TTL | 5 minutes (SDK-cached, auto-refreshed) |

These values are hardcoded in `MemWalWriteQueue`. We filed
[#296](https://github.com/MystenLabs/MemWal/issues/296) requesting official
documentation.

---

## 11. Lessons Learned & SDK Feedback

Building a production application on MemWal SDK v0.0.7 revealed several
patterns and pain points. We filed 13 GitHub issues on
[MystenLabs/MemWal](https://github.com/MystenLabs/MemWal/issues) covering:

### What works well

- **`remember()` + `recall()` core loop** — straightforward API for
  storing and retrieving text memories with semantic search.
- **Ed25519 delegate key auth** — simple, no wallet interaction needed for
  server-side agents.
- **`rememberBulk()`** — essential for seeding; up to 20 items per call.
- **`restore()`** — critical for rebuilding state after crashes on ephemeral
  hosting (Render free tier).

### What we had to work around

| Challenge | Our Workaround | Issue Filed |
|-----------|---------------|-------------|
| No exact-key lookup | Text-prefix anchors + KvMemWalClient overlay | [#289](https://github.com/MystenLabs/MemWal/issues/289) |
| No structured metadata | Embed JSON in text body | [#292](https://github.com/MystenLabs/MemWal/issues/292) |
| No pagination on `recall()` | Limit `topK` to 10, accept incomplete results | [#291](https://github.com/MystenLabs/MemWal/issues/291) |
| Undocumented rate limits | Built custom `MemWalWriteQueue` with retry | [#296](https://github.com/MystenLabs/MemWal/issues/296) |
| 5-min SEAL SessionKey expiry | Chunk batch operations, recreate client on error | [#295](https://github.com/MystenLabs/MemWal/issues/295) |
| No `recallBulk()` for dashboards | `Promise.all()` with N sequential calls | Documented for account #2 |
| Positional overload type bugs | Always use object-form `recall({ query, ... })` | [#293](https://github.com/MystenLabs/MemWal/issues/293) |

### Recommendations for other builders

1. **Build a write queue from day one.** Rate limits will hit you in production.
2. **Use a materialized read-model.** Semantic search is not a database query —
   don't use `recall()` as your primary read path.
3. **Plan for ephemeral hosting.** If your infra can lose local disk,
   `restore()` is your lifeline. Test cold-boot recovery early.
4. **Avoid the positional `recall()` overload.** Always use the object form
   `recall({ query, limit, namespace })` to prevent silent bugs.
5. **Keep text payloads structured.** Until the SDK supports metadata filtering,
   consistent text prefixes are the only way to filter by type.
