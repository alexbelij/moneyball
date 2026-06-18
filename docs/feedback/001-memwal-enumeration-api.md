# MemWal SDK: No Enumeration API Limits Independent Auditability

**Target:** MystenLabs/walrus-memory  
**Category:** Best Feedback — Walrus Memory World Cup Hackathon  
**Filed by:** Moneyball team (taken.wal.app)

## Context

Moneyball is a cabinet of 5 AI agents with persistent memory on Walrus (via MemWal)
that predict FIFA WC2026 matches. Each agent's parameters, predictions, and evolution
events are written to MemWal under namespace `mwc-agent:{agentId}`.

## Problem

The MemWal SDK exposes only semantic `recall()` (approximate top-K nearest neighbors),
with no deterministic `list()` / `scan()` / `enumerate()` endpoint. This means:

1. **No completeness guarantee** — a consumer cannot prove they have retrieved *all*
   memories in a namespace. Recall returns the nearest K results by embedding distance;
   memories that don't match the query semantically are invisible.
2. **Audit trail is best-effort** — our boot-hydration uses `topK: 500` with a broad
   query, but there is no way to verify all events were recovered.
3. **Pagination is absent** — large namespaces cannot be walked deterministically.

## Impact on Moneyball

We maintain an in-memory read-model rebuilt on cold boot. Without enumeration, the
reconstruction is best-effort — we added a deterministic fixture-based fallback
(`seedReadModel.ts`) to guarantee baseline data survives redeploys.

## Suggestion

Add `list(namespace, { cursor?, limit? })` returning all blob references ordered by
creation time with cursor-based pagination. This enables:

- Full namespace audit (enumerate all memories, verify count)
- Deterministic read-model reconstruction
- Third-party verification of on-chain history completeness
