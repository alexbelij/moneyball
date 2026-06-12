<!-- frontend-quality-requirements.md | v0.1.0 | 2026-06-12 -->
# Frontend Quality Requirements (mandatory, must be reflected in README)

1. **Cross-browser**: latest Chrome, Firefox, Safari, Edge. No browser-specific APIs without fallback.
2. **Responsive, mobile-first**: layout designed from ~360px up; breakpoints 360/768/1024/1440. Phaser room scales letterboxed; UI overlays reflow.
3. **Accessibility (a11y)**: semantic HTML, ARIA roles for modal/tabs/buttons, focus management (trap in modal, restore on close), visible focus ring, color contrast >= WCAG AA, `prefers-reduced-motion` respected.
4. **Keyboard control**: full app usable without mouse. Tab/Shift+Tab order, Enter/Space activate, Esc closes modal, arrow keys switch tabs.
5. **Valid code**: HTML validates (W3C), no console errors, TypeScript strict, lint clean.
6. **Lite mode ("Dashboard mode")**: alternative render without Phaser canvas and animations — plain dashboard (agents list, predictions, leaderboard, match info) built from the same zustand store. Toggle: pixel-art style power switch, fixed bottom-left. State persisted in `localStorage` (`moneyball.liteMode`). Lite mode is also the fallback when WebGL is unavailable and a perf/a11y feature (reduced motion users get it suggested).
