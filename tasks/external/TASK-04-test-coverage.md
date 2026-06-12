<!-- TASK-04-test-coverage.md | v0.1.0 | 2026-06-12 -->
# T04 — Test coverage: frontend store/lib + backend services

## Goal
Raise vitest coverage of pure logic to ~full: every exported function of the target modules has tests incl. edge cases. No E2E, no network.

## Targets (in priority order)
1. `apps/frontend/src/store/**` — state transitions, selectors, socket-event reducers (mock events).
2. `apps/frontend/src/lib/**` — pure helpers.
3. `apps/backend/src/**` services WITHOUT live MemWal/football-data: prediction scoring, match pipeline transforms, queue logic (`MemWalWriteQueue` — mock the relayer client), `UserSummaryStore` merge logic.

## Hard rules
- Mock all I/O (socket, fetch, MemWal relayer). Tests must run offline in <60s total.
- Follow existing test layout/naming (look at PR #5 tests for style). Use `bun scripts/bun-test-runner.ts` locally if node is absent.
- No production-code changes except: adding missing `export` for testability or extracting a pure function — each such change flagged in PR description.
- Coverage report (`vitest --coverage` text summary) pasted into PR description: before vs after per target dir.

## Acceptance criteria
- All new tests deterministic (no timers without fake timers, no real Date.now without injection).
- CI green; coverage of target dirs demonstrably increased.

## Out of scope
Phaser scenes, React component snapshot spam, visual tests.
