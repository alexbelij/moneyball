<!-- docs/TOOLCHAIN.md | v1.0.0 | 2026-06-17 -->
<!-- T65: canonical toolchain reference for contributors. -->

# Toolchain

Quick reference for anyone cloning and running the Moneyball monorepo.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20.x LTS | v20.18.1 tested; v22 should work |
| pnpm | 9.12.0 | `packageManager` field in root `package.json` enforces this |
| Git | 2.40+ | SSH access to the repo required |

> **Do not use bun to run tests.** `bun` breaks vitest worker forking. Use
> `pnpm exec vitest run` (which uses Node under the hood). You can use bun for
> one-off scripts, but never for the test suite.

---

## Setup

```bash
git clone git@github.com:anna-stolbovskaja/moneyball.git
cd moneyball
pnpm install
```

### jsonwebtoken symlink caveat

The `jsonwebtoken` package sometimes needs a manual Node.js crypto polyfill
symlink in CI or Docker. If you see `MODULE_NOT_FOUND` errors for
`jsonwebtoken`, run:

```bash
cd node_modules/.pnpm/jsonwebtoken@*/node_modules
ls  # confirm jsonwebtoken is here
```

The Dockerfile for the backend handles this automatically.

---

## Running locally

```bash
# Frontend (Vite dev server — run from apps/frontend)
pnpm -C apps/frontend dev

# Backend (tsx watch — run from apps/backend)
pnpm -C apps/backend dev

# Sleep-worker (manual trigger)
pnpm -C sleep-worker exec tsx src/index.ts
```

> **Always run vite from `apps/frontend`**, not the repo root — Vite resolves
> `@/` aliases relative to its own `tsconfig.json`.

---

## Testing

```bash
# Frontend (vitest — includes designDrift, contrast guard, all unit tests)
pnpm -C apps/frontend exec vitest run

# Backend
pnpm -C apps/backend exec vitest run

# Sleep-worker regressions
pnpm -C sleep-worker exec tsx test/regressions.ts

# Sleep-worker e2e simulation
pnpm -C sleep-worker exec tsx test/simulation.ts

# Typecheck everything
pnpm -r typecheck
```

### What the tests cover

- **designDrift** — catches token/style regressions against the design spec.
- **contrastWcag** — verifies WCAG AA contrast ratios for all token pairings.
- **Cyrillic scan** — CI step rejects any Cyrillic characters in `apps/*/src`.
- **Artifact guard** — CI step fails if `test-results/` or `playwright-report/`
  directories are committed.

---

## CI (GitHub Actions)

The `.github/workflows/ci.yml` workflow runs on every push to `main` and every
PR. It runs:

1. Typecheck (frontend + backend + sleep-worker)
2. Full test suites (frontend vitest, backend vitest, sleep-worker)
3. Cyrillic scan
4. Artifact directory guard

On pushes to `main`, a post-deploy **smoke test** hits the production `/health`
and `/api/agents` endpoints (warnings only — Render free tier may be sleeping).

---

## Deploying

### Backend (Render)

See `docs/deploy.md` for full Render setup. Quick re-deploy:

```bash
git push origin main  # Render auto-deploys from main
```

The Render free tier sleeps after 15 minutes of inactivity. First request after
sleep takes ~30 seconds.

### Frontend (Walrus Sites)

The frontend is deployed to Walrus Sites (`https://taken.wal.app`).

```bash
cd apps/frontend
pnpm exec vite build          # produces dist/
# Then use Walrus site-builder to publish dist/ to your site object
```

### Walrus memory update flow

To update an agent's memory blob on Walrus (via MemWal):

1. The sleep-worker runs a daily cycle: predict → score → reflect → evolve.
2. After evolution, it writes the new memory state to MemWal.
3. MemWal returns blob/object references stored in the backend.

Manual re-seed (development only):

```bash
pnpm -C sleep-worker exec tsx src/commands/seed.ts
```

---

## Project structure

```
moneyball/
├── apps/
│   ├── frontend/        # React + Phaser + Vite (Walrus Sites)
│   └── backend/         # Express + Socket.IO (Render)
├── packages/
│   └── shared/          # Shared types, socket events, schemas
├── sleep-worker/        # Autonomous agent cycle (predict/sleep/evolve)
├── docs/                # Architecture, API, deploy, this file
└── .github/workflows/   # CI quality gate
```

---

## Key conventions

- **1 task = 1 commit** on a dedicated branch (`task/T{N}-slug`).
- **No Cyrillic** in any source file under `apps/`.
- **All colors via `tokens.ts`** — never raw hex in components.
- **MemWal is the single source of truth** for agent memory.
- **File headers** on every source file: `ModuleName | vX.Y.Z | date`.
- **English only** in code, comments, and UI strings.
