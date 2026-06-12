<!-- TASK-07-bun-runner-compat.md | v0.1.0 | 2026-06-12 -->
# T07 — bun-test-runner: restore compatibility with the full backend suite

## Context
`apps/backend/scripts/bun-test-runner.ts` is the documented way to run tests in
node-less sandboxes. The T04 backend tests import `vi`, `beforeEach`, `afterEach`
from 'vitest' — none exist in the shim, so the runner now dies with a SyntaxError
on `memwalWriteQueue.test.ts` (its own header says it "must stay behavior-compatible
for the matchers used in test/"; that invariant is currently broken).

## Requirements
1. Extend the shim with: `beforeEach`/`afterEach` (per-describe-file semantics are fine),
   `vi.fn()` (with `mockResolvedValue`, `mockImplementation`, `mock.calls`),
   `vi.useFakeTimers`/`useRealTimers`/`advanceTimersByTime`/`runAllTimersAsync`
   (a simple manual clock is fine), and matchers used by the new tests:
   `toHaveBeenCalledWith`, `toHaveBeenCalledTimes`, `toHaveBeenCalledOnce`,
   `toBeTruthy`, `toBeNull`, `toBeUndefined`, async `rejects` if needed.
2. Keep the runner dependency-free (no npm installs) and under ~400 lines; if a test
   genuinely cannot be shimmed (e.g. module-registry reset), let the runner SKIP it
   with a clear `⊘ skipped (shim)` line instead of crashing.
3. Header version bump + changelog line in the file header.

## Acceptance criteria
- `bun scripts/bun-test-runner.ts` exits 0 on the full current backend test dir,
  printing pass/fail/skip counts; zero failed.
- Real vitest still green in CI (the shim must not require test changes; if a test
  must change to be shim-compatible, flag each change in the PR).
