# TASKS-V5 | v1.0.0 | 2026-06-12
# CRITICAL pack for the second Viktor. Priority: T17 -> T18 -> T19 -> T21 -> T20.
# Context: deployed site got 1/10 from the owner. Root causes: base background not used
# as-is, props were re-cut/re-cropped instead of using the owner-provided cutouts,
# agents not connected to the live backend.
# HARD RULES:
# - The baked background `assets/backgrounds/room_bg_v02_table_clock_pennant.png` is
#   rendered 1:1 as the bottom layer. NEVER crop, scale-up, recolor or re-cut it.
# - Overlay ONLY the owner-provided cutouts listed in `public/assets/props/props.json`
#   at their exact `target_xy`; y-sort/occlusion per `props_manifest.json` (table_occlusion).
# - Do NOT generate or re-cut any art. If an asset looks wrong, file a note in the PR
#   body instead of "fixing" pixels yourself.
# - Interactivity states strictly per `docs/interactivity-spec.md`.
# - TypeScript only, file headers (name|version|date), vitest for logic, branch per task.

## T17 — Room scene rebuild (CRITICAL)
- Phaser scene: draw base bg 1:1 (scene 1672x941, integer scaling to viewport, letterbox).
- Add props from props.json: exact target_xy, no resampling (nearest-neighbor only if the
  whole scene scales), y-sort using anchor values; table_occlusion per manifest.
- Delete all legacy re-cut/recropped sprites and any code paths referencing them.
- Hover/focus ring + cursor per interactivity-spec; keyboard navigation between
  interactive props (Tab order = spec order).
- Acceptance: pixel-diff of idle scene vs bare background shows differences ONLY at
  documented prop rects; screenshot in PR body; all tests green.

## T18 — Connect agents to live backend
- Socket.io client (reconnect + exponential backoff) + REST hydration on boot.
- `VITE_BACKEND_URL` from env (`.env.local` for dev; deploy uses the Render URL).
- Agent events drive the room: agent presence, prediction updates, AgentModal content
  from real API data (public endpoints only). Offline banner when socket is down.
- Acceptance: with backend URL set, room shows live agent data; with backend down,
  graceful offline state; unit tests for the event-store reducer.

## T19 — Prop states & animations (per interactivity-spec.md)
- exit_sign: 2 states; light_switch: toggle + room dim overlay; tv_set: static noise
  idle animation in MatchTV; coffee_machine/mug micro-interaction.
- All states keyboard-triggerable; respects prefers-reduced-motion.
- Acceptance: each spec item demonstrably works in preview; tests for state machines.

## T20 — Production build hardening (deploy artifact only)
- New `build:deploy` script: terser mangle (toplevel), drop console/debugger,
  no sourcemaps. Regular `build` stays readable. Document in README dev section.
- Acceptance: artifact runs identically; bundle size report in PR body.

## T21 — Playwright e2e smoke in CI
- CI job: vite preview + tiny API stub (no real secrets), scenarios: room loads,
  every interactive prop opens/closes, Lite toggle, wallet overlay open/close.
- Upload screenshots as CI artifacts.
- Acceptance: green job in GitHub Actions on the PR.
