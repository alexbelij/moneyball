# MemWal: Surface blob_id in Recall and Async Write Flow for Provenance Linking

**Target:** MystenLabs/walrus-memory  
**Category:** Best Feedback — Walrus Memory World Cup Hackathon  
**Filed by:** Moneyball team (taken.wal.app)

## Context

Moneyball writes agent events (predictions, outcomes, evolutions) to MemWal. The
frontend displays these in agent dossiers. We want users to click through from a UI
entry to the actual Walrus blob storing that memory.

## Problem

The `remember()` flow returns an `AcceptedResult` with a `job_id`. The final `blob_id`
is only available if you poll `waitForRememberJob()` to completion. In our architecture,
writes go through a `MemWalWriteQueue` that fires `remember()` and coalesces by key for
rate-limit management. The queue intentionally does not await the full job lifecycle
(fire-and-forget after acceptance) because:

1. Write throughput matters more than per-write blob ID tracking
2. Rate limits (429) make synchronous await impractical at scale

This means we never capture the `blob_id` that corresponds to a specific event. The only
way to recover it is via `recall()` with a matching query — but recall is semantic
(approximate), not key-based.

## Suggestion

Three potential approaches (any would solve the problem):

**Option A: Webhook callback on remember completion**
When the blob is finalized, fire a callback with `{ job_id, blob_id, namespace }` —
allowing async blob ID capture without polling.

**Option B: List by namespace**
Add a `listByNamespace(namespace)` endpoint returning `{ blob_id, created_at }` pairs —
enabling post-hoc blob ID discovery. (See also feedback #001 on enumeration.)

**Option C: Idempotency key + lookup**
Accept a client-supplied `idempotency_key` on `remember()` and expose
`getBlobByIdempotencyKey(key)` — mapping domain IDs (e.g., `prediction:dr_morgan:m1`)
to blob IDs without semantic search.

Any of these would close the gap between storing memory and surfacing its on-chain
provenance in the UI.
