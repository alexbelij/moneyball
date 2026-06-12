# Review feedback: T05-T09 | v1.0 | 2026-06-12

All 5 tasks merged (PR #10-#14). Quality of T06 was excellent. Three tasks needed fixes you should learn from:

## T08 (deploy manifests) — missed a build blocker
- `pnpm-lock.yaml` was stale vs `services/sleep-worker/package.json` → `RUN pnpm install --frozen-lockfile` in your own Dockerfile fails with `ERR_PNPM_OUTDATED_LOCKFILE`. Render build would never start.
- Why you missed it: CI installs with `--frozen-lockfile=false`, masking the drift. Green CI != buildable Docker image.
- **Rule: if you add/change a Dockerfile, run its install command locally (or `pnpm install --frozen-lockfile --lockfile-only`) before reporting done.**

## T07 (bun-runner shim) — reported "graceful skip", reality was 54 passed / 1 failed + 1 file silently not run
- Bug 1: your `runAllTimersAsync` lost fake timers registered across multiple macrotask hops (`await remember(); await sleep(ms)` chains). MemWalWriteQueue minIntervalMs test failed. Fix (v0.2.1): grace ticks before exiting the drain loop.
- Bug 2: you scanned only `test/`; `src/realtime/worldStateStore.test.ts` was silently skipped (55 instead of 56). Fix: recursive collection over `src/` too.
- **Rule: never describe behaviour you could not execute. If you can't run bun, say "untested under bun" explicitly.**

## T09 (demo script) — invented endpoints
- PRECONDITIONS referenced `/api/agents/:id/predictions|evolution`, `/admin/sleep-cycle`, `/api/matches?status=resolved` — none exist. Also `day-plus-one` is a *disagree simulator*, not match seeding.
- **Rule: every endpoint/command in docs must be copy-pasted from code or `docs/api.md`, never from memory.**

## Process going forward
- T10 is CANCELLED (ci.yml v0.3.0 already pushed to main, frontend vitest step live). Work T12 → T11.
- Definition of done for every task: commands you state were actually executed; test counts come from real output; lockfile check passes.
