# @moneyball/memwal-utils

> Rate-limited write queue, KV overlay, and key-builder helpers for [MemWal SDK](https://github.com/MystenLabs/MemWal) — born from production use in the [Moneyball](https://taken.wal.app) World Cup project.

[![MemWal SDK](https://img.shields.io/badge/MemWal_SDK-v0.0.7-blue)](https://github.com/MystenLabs/MemWal)
[![Walrus](https://img.shields.io/badge/Walrus-mainnet-green)](https://walrus.xyz)

---

## Why this exists

Building a production application on MemWal SDK v0.0.7 reveals three gaps:

1. **Rate limits hit fast.** The relayer returns 429s with `retry_after_seconds` but the SDK provides no built-in queuing. If you write from multiple hot paths (predictions, user events, parameter updates), you need a coalescing write queue.

2. **No key-value semantics.** MemWal is append-only semantic search (`remember` / `recall`). For versioned agent parameters or locks you need exact-key lookup with compare-and-swap — which doesn't exist natively.

3. **String keys drift.** Without structured metadata, all record types are distinguished by text prefixes. Typos cause silent recall failures. A centralized key builder eliminates this.

This package extracts our solutions into reusable utilities.

---

## Install

```bash
# Inside a pnpm monorepo (as workspace dependency):
pnpm add @moneyball/memwal-utils --filter your-app

# Or standalone:
npm install @moneyball/memwal-utils
```

**Peer dependency:** `@mysten-incubation/memwal >= 0.0.7` (optional — you can provide your own `remember`/`recall` functions).

---

## Quick Start

```ts
import { MemWal } from '@mysten-incubation/memwal';
import { MemWalWriteQueue, KvOverlay, createKeyBuilder } from '@moneyball/memwal-utils';

// 1. Create MemWal client
const memwal = MemWal.create({
  key: process.env.MEMWAL_KEY,
  accountId: process.env.MEMWAL_ACCOUNT_ID,
  serverUrl: 'https://relayer.memory.walrus.xyz',
  namespace: 'my-app',
});

// 2. Wrap remember() for the write queue
const remember = async (text: string) => {
  const job = await memwal.remember(text);
  if (job?.job_id) await memwal.waitForRememberJob(job.job_id);
};

// 3. Create a write queue (production-tested defaults)
const queue = new MemWalWriteQueue(remember);

// 4. Fire-and-forget writes — queue handles throttling
queue.enqueue('user:0x8a71', JSON.stringify(userData));
queue.enqueue('prediction:match-1', JSON.stringify(prediction));
```

---

## API Reference

### `MemWalWriteQueue`

A non-blocking, coalescing write queue with exponential backoff.

```ts
const queue = new MemWalWriteQueue(rememberFn, {
  debounceMs: 1500,    // coalesce window (default: 1500)
  minIntervalMs: 1200, // floor between writes (default: 1200)
});

queue.enqueue(key, text);    // non-blocking
queue.pendingCount;          // number of pending writes
```

**How it works:**

| Mechanism | What it does |
|-----------|-------------|
| Key coalescing | Same key enqueued twice → only latest value written |
| Min interval | ≥ 1200ms between `remember()` calls |
| Server-hint backoff | Reads `retry_after_seconds` from 429 errors |
| Exponential backoff | Other errors: 1s → 2s → 4s → … → 60s cap |

**Production values** (tested against Walrus mainnet relayer):

| Parameter | Value | Why |
|-----------|-------|-----|
| `debounceMs` | 1500 | Catches rapid param updates during sleep cycles |
| `minIntervalMs` | 1200 | Stays under the relayer's undocumented rate limit |
| Max backoff | 60s | Capped to prevent indefinite delays |
| `rememberBulk()` max | 20 items | Discovered by trial (not in SDK docs) |

---

### `KvOverlay`

Key-value semantics over MemWal's append-only store.

```ts
const recall = async (query: string) => memwal.recall(query);

const kv = new KvOverlay(remember, recall, {
  prefix: 'kv:myapp',  // namespace for KV entries
  recallLimit: 10,      // max results to inspect (default: 10)
});

// Write with sequence number
await kv.put('params:agent_1', { bias: 0.3 }, { seq: 1 });

// Read — returns highest-seq entry
const entry = await kv.get<AgentParams>('params:agent_1');
// → { value: { bias: 0.3 }, seq: 1 }

// CAS write — fails if current seq ≠ 1
await kv.put('params:agent_1', updated, { seq: 2, ifSeq: 1 });
```

**Storage format:**

```
kv:myapp key=params:agent_1 seq=5
{"bias":0.3,"aggression":0.7}
```

**Limitations:**

- Semantic recall may return near-matches — the overlay filters by exact key but this adds latency. See [MystenLabs/MemWal#289](https://github.com/MystenLabs/MemWal/issues/289).
- CAS is safe only with a single writer per key (the typical pattern for agent state).

---

### `createKeyBuilder`

Type-safe key construction with namespace prefixes.

```ts
const Keys = createKeyBuilder('myapp', {
  prediction: (agentId: string, matchId: string) =>
    `prediction agent=${agentId} match=${matchId}`,
  params: (agentId: string) =>
    `params agent=${agentId}`,
  userSummary: (userId: string) =>
    `user_summary userId=${userId}`,
});

Keys.prediction('dr_morgan', 'GER-SCO');
// → "myapp:prediction agent=dr_morgan match=GER-SCO"

Keys.params('dr_morgan');
// → "myapp:params agent=dr_morgan"
```

The package also exports `MoneyballKeys` — the actual key schema used in production — as a reference implementation.

---

## Architecture: How Moneyball uses these utilities

```
Agent predictions  ──┐
Agent evolution    ──┤
Agent parameters   ──┼──▶  MemWalWriteQueue  ──▶  MemWal relayer  ──▶  Walrus blobs
User summaries     ──┤        (coalescing,
User disagrees     ──┘         throttling)

                                   │
                                   ▼
                          KvOverlay (CAS)
                          ┌──────────────────┐
                          │ put(key, val, {   │
                          │   seq, ifSeq      │
                          │ })                │
                          └──────────────────┘
                                   │
                                   ▼
                          KeyBuilder
                          ┌──────────────────┐
                          │ Keys.personality( │
                          │   'dr_morgan'     │
                          │ )                 │
                          └──────────────────┘
```

**Full integration reference:** [docs/walrus-memory-integration.md](../../docs/walrus-memory-integration.md)

---

## Lessons Learned (MemWal SDK v0.0.7)

| Challenge | Workaround | Issue |
|-----------|-----------|-------|
| No exact-key lookup | Text-prefix anchors + KvOverlay | [#289](https://github.com/MystenLabs/MemWal/issues/289) |
| No structured metadata | Embed JSON in text body | [#292](https://github.com/MystenLabs/MemWal/issues/292) |
| No pagination on `recall()` | Limit `topK`, accept incomplete | [#291](https://github.com/MystenLabs/MemWal/issues/291) |
| Undocumented rate limits | MemWalWriteQueue with retry | [#296](https://github.com/MystenLabs/MemWal/issues/296) |
| 5-min SEAL SessionKey | Chunk batches, recreate on error | [#295](https://github.com/MystenLabs/MemWal/issues/295) |
| Positional `recall()` bugs | Always use object form | [#293](https://github.com/MystenLabs/MemWal/issues/293) |

**Recommendations:**
1. Build a write queue from day one — rate limits will hit in production.
2. Use a materialized read-model — don't use `recall()` as your primary read path.
3. Plan for ephemeral hosting — `restore()` is your lifeline on platforms like Render.
4. Keep text payloads structured — consistent prefixes are the only filter mechanism.

---

## Publishing

### As an npm package

```bash
cd packages/memwal-utils
pnpm build                    # compile to dist/
npm publish --access public   # → @moneyball/memwal-utils on npm
```

### As a MemWal ecosystem contribution

The write queue and KV overlay address universal pain points. To propose upstream inclusion:

1. Open an issue on [MystenLabs/MemWal](https://github.com/MystenLabs/MemWal/issues) titled "RFC: Write queue + KV overlay utilities"
2. Reference this package and the issues it solves (#289, #291, #292, #293, #295, #296)
3. Offer to adapt the code to the SDK's internal conventions

### As a standalone repo

```bash
# Fork this package into its own repository
mkdir memwal-utils && cp -r packages/memwal-utils/* memwal-utils/
cd memwal-utils
# Update package.json repository field
npm publish --access public
```

---

## License

MIT — see [LICENSE](../../LICENSE) in the monorepo root.
