<!-- tasks/external/README.md | v0.1.0 | 2026-06-12 -->
# External Tasks — onboarding for a Viktor with zero project context

## What this project is
**Moneyball** — Walrus Memory World Cup hackathon entry (deadline 2026-06-24). A SNES-style arcade cabinet web app: 5 AI agents live in a pixel-art room and predict World Cup 2026 matches. Their memory persists on **MemWal / Walrus mainnet** (judging criterion #1: memory depth day1 vs day4+).

- Monorepo: pnpm workspaces (`apps/frontend`, `apps/backend`, `packages/*`, `sleep-worker`).
- Frontend: React 18 + TypeScript + Vite + Phaser 3 + zustand + socket.io-client + @mysten/dapp-kit (Sui auth).
- Backend: Express + Socket.io, Sui auth -> JWT, MemWal as the ONLY storage.
- Tests: vitest. In a sandbox without node/npx use `bun scripts/bun-test-runner.ts`; plain `pnpm vitest` works in normal envs. CI runs on GitHub Actions and must stay green.

## Hard rules (non-negotiable)
1. **TypeScript only.** Strict mode. Real, compiling code — no pseudo-code.
2. **No LLM calls, no embeddings, no new storage** (MemWal is the only persistence; frontend may use localStorage for UI prefs only).
3. **Every code file starts with a header comment**: `<filename> | <version> | <date>`.
4. **Tests are mandatory** for all logic you add. PR must pass `pnpm -r typecheck` and the test suite.
5. **One PR per task**, branch `task/<task-id>-<slug>` from `main`. Small focused diffs. No drive-by refactors.
6. Do **not** touch: `props.json`, `props_manifest.json`, `apps/frontend/public/assets/**`, `.github/workflows/**`, anything under `apps/backend/src/memwal/**` unless the task says so.
7. No new runtime dependencies without an explicit note in the PR description explaining why.
8. Read `docs/frontend-quality-requirements.md` and `docs/decisions-distilled.md` before starting.

## Definition of done (every task)
- PR open against `main`, description = task id + what/why/how to verify.
- Typecheck green, tests green, zero console errors.
- Acceptance criteria from the task file demonstrably met (screenshots in PR welcome).

## Reporting
When done, report PR numbers back to Anna. The in-project Viktor will review diffs and run tests; design questions go to Anna.

## Task list (priority order)
| ID | File | Title |
|----|------|-------|
| T01 | TASK-01-dashboard-mode.md | Lite "dashboard mode" + pixel power-switch toggle |
| T02 | TASK-02-a11y-keyboard.md | Accessibility & keyboard-control layer |
| T03 | TASK-03-docs-architecture.md | ARCHITECTURE.md + api.md with mermaid diagrams |
| T04 | TASK-04-test-coverage.md | Test coverage for frontend store/lib + backend services |
