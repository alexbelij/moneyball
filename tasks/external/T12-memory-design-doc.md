# T12 | v1.0 | 2026-06-12 — docs/memory-design.md draft (Memory Depth = main judging criterion)

Write `docs/memory-design.md` (EN) documenting the actual memory architecture. Source of truth = code, not imagination:
`apps/backend/src` — `UserSummaryStore`, `MemWalWriteQueue`, `AgentEventService`; sleep-worker evolution cycle; MemWal relayer usage.

## Required content
1. Memory model: what each agent persists (summaries, predictions, evolution events), data shapes (real TS types copied from code).
2. Write path: queue batching, minIntervalMs throttle, retry/backoff — diagram (mermaid sequence).
3. Sleep/evolution cycle: trigger, inputs, how agent parameters change; "LLM never mutates numbers" invariant.
4. Read path: how summaries are rehydrated on auth (`/api/me/summary`), disagree flow.
5. Why no embeddings/LLM-memory in MVP (explicit MVP vs V2/V3 section).
6. Walrus/MemWal mainnet specifics: object layout, relayer, costs.

## Constraints
- Every claim must reference a real file/symbol. Reviewer cross-checks against code; invented APIs = rejection (this happened in T09).
- Branch `task/t12-memory-design`, PR to main. ~2-4 pages, dense, engineering-level.
