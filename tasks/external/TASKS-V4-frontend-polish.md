# TASKS-V4 | v1.0.0 | 2026-06-12
# Frontend polish pack for the second Viktor. Priority: T15 -> T14 -> T13 -> T16.
# Rules: TypeScript only, file headers (name|version|date), vitest coverage for logic,
# no new heavy deps, branch per task `task/T1X-...`, do NOT touch .env*/secrets.

## Feedback on T11/T12 (merged as PR #16/#17)
- T12 memory-design.md: verified line-by-line against code, zero discrepancies. Excellent.
- T11 README: 2 fixes applied by reviewer: (a) `docs/assets/hero.png` referenced but file
  does not exist -> commented out until screenshot lands; (b) "extended timer-sensitive
  suite" -> it is the SAME suite via bun-test-runner shim. Lesson: never reference assets
  that are not in the tree; verify claims against code.

## T13 — Asset preload + skeleton loading state
- index.html: `<link rel="preload" as="image">` for room background
  (`assets/backgrounds/room_bg_v02_table_clock_pennant.png`) and `as="fetch"` for
  `assets/props/props.json` + `props_manifest.json` (crossorigin).
- React: SNES-styled loading skeleton (pixel-art frame + animated dots, CSS only) shown
  until Phaser scene emits `ready`; same for LiteDashboard while first API call is in flight.
- No layout shift: skeleton reserves the 1672x941-scaled container.
- Acceptance: Lighthouse LCP improves on cold load; skeleton visible on throttled 3G;
  42/42 tests stay green + new tests for the loading state hook.

## T14 — SNES UI kit (buttons, modals, toasts)
- Create `src/components/ui/` with `PixelButton`, `PixelModal`, `PixelToast`:
  single CSS module with the room palette, 2px pixel borders, pressed/hover/disabled/focus
  states, focus-visible outlines (a11y), Escape/overlay-click close for modal (trap focus).
- Refactor `AgentModal.tsx` and `WalletFlowOverlay.tsx` to use the kit (no visual regressions
  beyond intended styling; keyboard nav preserved).
- Acceptance: zero native-looking buttons/dialogs remain; axe-clean; tests for modal
  focus-trap and keyboard close.

## T15 — Interactive reports: predictions table + accuracy chart
- New `src/components/StatsReport.tsx` rendered inside StatsBoard modal AND in Lite mode:
  1) sortable table (agent x match): prediction, actual, Brier component; sticky header;
  2) SVG line chart of rolling Brier score per agent over resolved matches — hand-rolled
     SVG (NO chart deps), pixel-styled, hover tooltip, keyboard-accessible points.
- Data: existing public endpoints only (`/api/public/*`); degrade gracefully when <2
  resolved matches (empty-state message).
- Acceptance: works against live backend URL from `.env.local`; unit tests for the
  Brier-series builder (pure function in `src/lib/brierSeries.ts`).

## T16 — Bundle optimization
- vite.config.ts: `build.rollupOptions.output.manualChunks` -> separate `phaser` vendor
  chunk; `React.lazy` the Phaser scene wrapper so Lite mode never downloads Phaser.
- Target: initial JS (Lite path) < 250 kB gzip; report before/after sizes in PR body.
- Acceptance: `vite build` green, both modes work in preview, no circular-import warnings.
