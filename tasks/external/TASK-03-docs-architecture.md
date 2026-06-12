<!-- TASK-03-docs-architecture.md | v0.1.0 | 2026-06-12 -->
# T03 — docs/ARCHITECTURE.md + docs/api.md (with mermaid)

## Goal
Jury-grade technical documentation derived from the actual code (read the repo, do not invent).

## Deliverables
1. `docs/ARCHITECTURE.md`:
   - System overview: frontend (React+Phaser) <-> backend (Express+Socket.io) <-> MemWal/Walrus mainnet <-> football-data.org.
   - Mermaid diagrams: C4-ish component diagram; sequence diagram "match result -> agent prediction scoring -> memory write to MemWal"; sequence "Sui wallet auth -> JWT -> socket session".
   - Key modules table: `AgentEventService`, `UserSummaryStore`, `MemWalWriteQueue`, sleep-worker, match pipeline — one paragraph each: responsibility, inputs/outputs, failure handling.
   - Data flow of agent memory: what is written, when, structure, how day1 vs day4+ depth grows (this is judging criterion #1 — make it prominent).
2. `docs/api.md`: every REST endpoint and Socket.io event (name, direction, payload TS type, auth requirement, example). Source from backend route/handler code and `packages/shared` types.

## Hard rules
- Everything stated must be verifiable in code; cite file paths. Unknown/ambiguous -> mark `TBD(question for Anna)` instead of guessing.
- English. Mermaid blocks must render on GitHub (test in PR preview).

## Acceptance criteria
Reviewer can pick 5 random claims and find each in the cited file. No invented endpoints/fields.

## Out of scope
README.md itself (kept in-house), deployment docs.
