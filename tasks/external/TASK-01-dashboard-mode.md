<!-- TASK-01-dashboard-mode.md | v0.1.0 | 2026-06-12 -->
# T01 — Lite "Dashboard mode" + pixel power-switch toggle

## Goal
A no-canvas alternative UI: when Lite mode is ON, the Phaser room is not mounted; instead a plain, fast, accessible dashboard shows the same live data. Toggle is a pixel-art style power switch fixed bottom-left.

## Why
Performance/a11y/mobile fallback and a judge-visible feature. Also the fallback when WebGL is unavailable.

## Context you need
- `apps/frontend/src/App.tsx` mounts `phaser/PhaserGame.tsx` plus overlay components (`components/HUD.tsx`, `AgentModal.tsx`, `StatsBoard.tsx`, `MatchTV.tsx`).
- All live data already flows through the zustand store (`src/store/`) fed by socket.io events (`src/events/`). **Reuse the store; do not open new sockets.**
- Read `docs/frontend-quality-requirements.md` — Lite mode spec is item 6.

## Deliverables
1. `src/store/uiPrefs.ts` — zustand slice or standalone store: `liteMode: boolean`, `toggleLiteMode()`, persisted to `localStorage` key `moneyball.liteMode`; initial value: stored value, else `true` if `!WebGLRenderingContext` or `prefers-reduced-motion: reduce`.
2. `src/components/LiteModeToggle.tsx` — pixel-style switch (pure CSS, image-rendering: pixelated; NO new image assets), fixed bottom-left, `role="switch"`, `aria-checked`, keyboard operable, visible focus.
3. `src/components/LiteDashboard.tsx` (+ small subcomponents if needed) — sections: agents (5 cards: name, status, current prediction, accuracy), leaderboard, next/current match, memory stats if present in store. Mobile-first CSS, no animations.
4. Conditional mount in `App.tsx`: `liteMode ? <LiteDashboard/> : <PhaserGame/>`; overlay components keep working in both modes or are integrated into the dashboard.
5. Vitest tests: store logic (init from localStorage/media query, toggle persists), LiteDashboard renders from a mocked store snapshot, toggle a11y attributes.

## Acceptance criteria (cheap to verify)
- `pnpm -r typecheck` green; new tests green; no Phaser code imported when lite mode is on (verify via dynamic import or lazy mount).
- Toggling does not lose socket connection or store state.
- Dashboard usable at 360px width; zero console errors.

## Out of scope
Styling parity with the room, new pixel art assets, backend changes.
