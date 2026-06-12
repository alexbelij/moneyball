# T11 | v1.0 | 2026-06-12 — README.md EN landing ("README sells")

Rewrite root `README.md` in English as a judge-facing landing page for the Walrus Memory World Cup.

## Required sections (in order)
1. Hero: project name, one-line pitch (5 AI agents with persistent MemWal memory predict World Cup 2026, SNES-cabinet UI), screenshot placeholder `docs/assets/hero.png`, badges (CI, license).
2. "Why Memory Depth": 3-5 bullets linking to `docs/memory-design.md` — agents remember, sleep, evolve; MemWal mainnet is the ONLY storage.
3. Architecture: short paragraph + link to `docs/ARCHITECTURE.md`; small mermaid overview (frontend / backend / sleep-worker / MemWal relayer).
4. Quickstart: pnpm install, .env setup (reference `.env.example`), dev commands for backend+frontend, test commands (vitest; `pnpm -C apps/backend test:bun` note).
5. Demo: link `docs/demo-script.md`, video placeholder.
6. Judging criteria map: table Criterion -> Where to look (Memory Depth -> memory-design.md + live evolution endpoint; Creativity -> SNES cabinet; Walrus Mainnet -> relayer config).

## Constraints
- English only. No invented endpoints/commands — verify each against the repo (`docs/api.md`, package.json scripts). Reviewer will check every command.
- Branch `task/t11-readme-landing`, PR to main. Do NOT touch other files.
