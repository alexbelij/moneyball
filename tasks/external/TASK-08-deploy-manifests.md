<!-- TASK-08-deploy-manifests.md | v0.1.0 | 2026-06-12 -->
# T08 — Backend deploy manifests (free tier), no secrets

## Goal
Prepare everything needed to deploy `apps/backend` to a free-tier host (Render or
Fly.io — pick one and justify in the PR) so the deploy itself is a 10-minute
secrets-only operation done by Anna/Viktor. You will NOT receive any secrets.

## Requirements
1. `Dockerfile` (multi-stage, pnpm, node 20-alpine, non-root user) building only the
   backend workspace + its workspace deps (`packages/shared`). Image must start with
   `node dist/index.js` (add a `build` script if missing) or `tsx src/index.ts` if
   compiling is impractical — justify the choice.
2. Host manifest (`render.yaml` or `fly.toml`): port binding from `PORT` env,
   healthcheck on `GET /health`, free-tier instance size, autosleep acceptable.
3. `apps/backend/.env.example` covering every env var read in `src/env.ts` with a
   one-line comment each (placeholder values only — grep the codebase, document all).
4. `docs/deploy.md`: step-by-step (≤1 page) — create service, set env vars, point
   frontend `VITE_BACKEND_URL`, verify `/health` + one Socket.io connect. Include a
   CORS checklist: which origins must be allowed for the Walrus Sites frontend.
5. CI: add a job-level `docker build` smoke (build only, no push) IF it fits in free
   minutes; otherwise document the local build command in docs/deploy.md.

## Acceptance criteria
- `docker build` succeeds locally from repo root (paste the tail of the build log in the PR).
- No secret values anywhere in the diff.
