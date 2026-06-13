# TASKS-V6 | v1.0.0 | 2026-06-13
# Pack for the second Viktor. Priority: T22 -> T25.
# Context: the owner will personally re-place every prop. 80% of current placements are
# wrong and several assets are bad cutouts. We are building her a CONSTRUCTOR page so she
# can pick assets, drag/position/layer them and export a config back to us.
# HARD RULES (unchanged from V5):
# - NEVER generate, re-cut, re-encode or "fix" any image. Binaries are read-only.
# - The baked background renders 1:1; never crop/scale-up/recolor it.
# - TypeScript only, file headers (name|version|date), vitest for pure logic,
#   branch per task (task/T22-..., task/T25-...), screenshots in PR body.
# - Do not touch game/scene code in T22. T25 touches ONLY a new ambient layer module.
# - Base your branches on main.

## T22 — Prop constructor page (CRITICAL)
Standalone static editor, dev-only. No backend, no auth.
- Entry: `apps/frontend/editor.html` (second Vite input). MUST be excluded from
  `build:deploy` output (assert in a test or build check).
- Canvas: background `assets/backgrounds/room_bg_v02_table_clock_pennant.png` at 1:1
  (1672x941 source pixels = editor coordinate space), zoom x1/x2 toggle (nearest-neighbor,
  CSS `image-rendering: pixelated`), pan when zoomed.
- Asset palette (left panel), three sources, clearly grouped:
  1. every PNG already in `public/assets/props/` and `public/assets/characters/`
     (build the list at dev time — e.g. `import.meta.glob` over a mirrored src folder or a
     small generator script writing `editor-assets-manifest.json`; do NOT hand-maintain it),
  2. owner uploads: `<input type=file multiple accept=image/png>` -> object URLs, keep the
     ORIGINAL filename and natural w/h; never draw them to a canvas for re-export,
  3. current scene: import `public/assets/props/props.json` as the starting state (button
     + auto-load on open).
- Per placed prop: pointer drag; arrow keys = 1px nudge, Shift+arrows = 10px; numeric
  inputs x/y; scale (default 1, free decimal, warn visually when != integer); flip-x;
  visibility toggle; lock; duplicate; delete.
- Layers panel (right): full z-order list, drag to reorder, top = front. Selection synced
  canvas<->list. Show id + source filename + (uploaded) badge.
- Export (the whole point):
  - Output JSON in EXACTLY the props.json schema currently used by the game. Unknown/extra
    fields from the imported props.json (interactivity flags, anchors, swapStates, notes…)
    MUST pass through untouched for props the owner did not delete.
  - For uploaded files: `src` = `props/<original filename>`; export additionally includes a
    `new_files` array listing filenames the repo does not have yet, so the owner knows
    which PNGs to send along with the JSON.
  - Buttons: "Copy JSON" + "Download props.json". Also autosave working state to
    localStorage (restore on reload, "Reset to repo state" button).
- Editor UI style: plain and functional is fine (internal tool; design-spec does NOT
  apply here). Keyboard reachable controls, labels on inputs.
- Tests (vitest, pure logic only): import->export round-trip preserves unknown fields;
  z-reorder ops; nudge math; new_files computation. No e2e needed.
- Acceptance: screenshot of the editor with >=3 props moved + exported JSON snippet in
  the PR body; `pnpm build` green; `DEPLOY_MODE=1` build contains no editor chunk.

## T25 — Living light: dust + flicker ambient layer
The room light currently looks dead. Add a procedural ambient layer to the Phaser scene.
- New module `AmbientLayer` rendered above props, below UI. 100% procedural — NO image
  assets, NO art generation.
- Dust motes in the two ceiling-lamp light cones: 1-2px squares, max ~20 alive, slow
  drift (2-6 px/s) with slight sine wobble, alpha 0.05-0.18, ADD blend, spawn/despawn
  fade. Light-cone bounds = constants at the top of the file (rough trapezoids under each
  lamp; eyeball from the background, document the coords).
- Lamp flicker: a very subtle full-cone alpha oscillation, irregular (random interval
  4-12s, dip 3-6% for 80-150ms). Never strobe. Both lamps independent.
- `prefers-reduced-motion`: layer fully disabled (no particles, no flicker).
- Perf: no per-frame allocations (pool particles), no physics engine; must hold 60fps.
- Config object exported for tuning; vitest for the spawn/lifetime/bounds math.
- Acceptance: short GIF or 2 screenshots (cones visible) in PR body; tests green.
- NOTE (no action): T19 steam attaches to the `mug` prop; the mug is currently not
  placed visibly. Placement will come from the owner's T22 export — do not move props.
