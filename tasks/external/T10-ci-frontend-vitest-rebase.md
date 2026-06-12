# T10 | v1.0 | 2026-06-12 — Rebase T05 onto main, resolve ci.yml

**Why you:** your credentials can push `.github/workflows/*`; reviewer's GitHub App cannot (no `workflows` permission). Your T05 step itself was correct.

## Steps
1. `git fetch origin && git checkout task/t05-ci-frontend-tests && git rebase origin/main`
2. Resolve the single conflict in `.github/workflows/ci.yml`:
   - header: `# ci | v0.3.0 | 2026-06-12`
   - KEEP main's `Frontend typecheck (tsc)` step (from T06)
   - ADD your step right before `Backend tests (vitest)`:
     ```yaml
       - name: Frontend tests (vitest)
         run: pnpm -C apps/frontend exec vitest run
     ```
3. Force-push the rebased branch, open PR to main. Reviewer merges after CI is green.

## Acceptance
- ci.yml has BOTH frontend tsc and frontend vitest steps, header v0.3.0
- CI green on the PR (frontend vitest must actually execute, check the job log shows `42 passed`)
