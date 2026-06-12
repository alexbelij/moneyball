<!-- TASK-02-a11y-keyboard.md | v0.1.0 | 2026-06-12 -->
# T02 — Accessibility & keyboard-control layer

## Goal
Make all React overlay UI fully keyboard-operable and screen-reader friendly per `docs/frontend-quality-requirements.md` items 3–4. (Phaser canvas itself is out of scope.)

## Context you need
- Components: `src/components/AgentModal.tsx` (has tabs Predictions/Evolution/Memory), `HUD.tsx`, `StatsBoard.tsx`, `WalletControls.tsx`, `MatchTV.tsx`.

## Deliverables
1. `src/lib/a11y/useFocusTrap.ts` — focus trap hook: traps Tab/Shift+Tab inside a container, restores focus on unmount, Esc triggers `onClose`.
2. `src/lib/a11y/useRovingTabs.ts` — roving tabindex for tablists (ArrowLeft/Right/Home/End), WAI-ARIA Tabs pattern.
3. Apply to `AgentModal`: `role="dialog"` `aria-modal`, labelled by its title; tabs get `role="tablist"/"tab"/"tabpanel"` + `aria-selected`/`aria-controls`.
4. Sweep all listed components: every interactive element is a real `<button>`/`<a>` (no clickable divs), has an accessible name, visible `:focus-visible` style; add a global focus-ring CSS token.
5. `@media (prefers-reduced-motion: reduce)` — disable CSS transitions/animations globally.
6. Vitest + @testing-library/react tests: focus trap cycles & restores, Esc closes, arrow keys move tab selection, every rendered interactive element has an accessible name (axe-core via `vitest-axe` is welcome but optional — note dependency in PR if added).

## Acceptance criteria
- Tests green, typecheck green.
- Manual script in PR description: full journey (open modal -> switch 3 tabs -> close) executed keyboard-only.

## Out of scope
Phaser canvas interactions, color palette changes, Lite dashboard (T01 handles its own a11y).
