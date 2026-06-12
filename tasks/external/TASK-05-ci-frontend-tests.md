<!-- TASK-05-ci-frontend-tests.md | v0.1.0 | 2026-06-12 -->
# T05 — CI: run frontend tests + lockfile sanity

## Context
T01/T02/T04 added 42 frontend vitest tests, but `.github/workflows/ci.yml` only runs
backend + sleep-worker. Frontend tests are validated by nobody. (Found in review:
they initially failed 14/42 due to missing RTL auto-cleanup — exactly because no
pipeline ever executed them.)

## Requirements
1. Add a CI step: `pnpm -C apps/frontend exec vitest run` (node 20 + pnpm already set up in the job).
2. Keep total CI wall time under ~5 min; use the existing job, no new workflow.
3. Verify `pnpm install --frozen-lockfile=false` resolves the new frontend devDeps
   (vitest 3.x, jsdom 26, @testing-library/*) — if pnpm-lock.yaml needs regeneration, do it in this PR and say so.
4. Do NOT add a frontend `tsc --noEmit` step yet — main currently has 5 pre-existing
   type errors (see T06). Add the step in T06, not here.

## Acceptance criteria
- CI green on the PR with the new step visibly executing 42+ frontend tests.

## Out of scope
Coverage thresholds, e2e, browser matrices.
