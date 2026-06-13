# TASKS-V8 | v1.0.0 | 2026-06-13
# Pack for the second Viktor — PIXELIZE every UI surface to the site palette.
# Owner directive: "интерфейсы кнопок, окон и прочих элементов адаптировать под
# пиксельный дизайн и цвета сайта". Full version, not MVP.
#
# HARD RULES:
# - MUST use the frontend_design skill + docs/design-spec.md (binding). Dashboards
#   "from the head" = generic = REJECT. Screenshots REQUIRED in every UI PR.
# - TypeScript only; file headers (name|version|date); branch task/T3x-...; vitest for
#   any pure logic; keep a11y (focus trap, roving tabs, keyboard, reduced-motion).
# - Do NOT generate/re-cut images. Do NOT move props.
#
# ── AUDIT (verified 13.06) ──────────────────────────────────────────────────────
# ALREADY pixel (design-spec): PixelButton, PixelModal, PixelToast, AgentModal,
#   WalletFlowOverlay (T14), StatsReport (T15).
# LEGACY navy-SaaS + emoji (MUST be converted):
#   - StatsBoard.tsx     (#111827 navy, borderRadius 10, 🏆, ✕)
#   - LiteDashboard.tsx  (#0f172a, Courier New, 🏆, borderRadius, blue/green chips)
#   - HUD.tsx            (rgba black, borderRadius 8, #1d4ed8 blue buttons)
#   - WalletControls.tsx (#374151 / #111827 navy, borderRadius)
# DRIFT BUG: palette is hardcoded per-file and several files (T14) used WRONG wood
#   values (#3a3020/#7a7060) instead of design-spec (#341d0e wood-700 / #4e2912
#   wood-500). No single source of truth exists. Fix this first (T33).

## T33 — Single design-token module (source of truth) — DO FIRST
- Create `apps/frontend/src/styles/tokens.ts` exporting the EXACT design-spec palette
  (bg-black, wall-green/-2, wood-900/700/500/300/200/100, paper/-bright, accents/gold),
  the 8px spacing scale, pixel font-family, border width (2px), bevel shadow helpers
  (SNES light top/left + dark bottom/right), and zIndex layers.
- Migrate ALL components (incl. the already-pixel ones with wrong wood values) to import
  from tokens.ts. After this, grep for raw `#` hex in components/ must be ~empty.
- vitest: token values match design-spec constants.

## T34 — Convert legacy surfaces to pixel (StatsBoard, LiteDashboard, HUD, WalletControls)
- Reskin each to design-spec: paper/wall-green panel fills, 2px borders, NO border-radius,
  hard bevel shadows, pixel font, room palette. Remove ALL emoji icons (🏆/✕/etc.) — use
  pixel glyphs or text labels per design-spec. Reuse PixelButton/PixelModal/PixelToast.
- Leaderboard table: paper panel, wood ramp rows, SNES header; rank as pixel medal/text,
  not emoji.
- Keep all existing data wiring & a11y intact. Screenshots of each surface in the PR.

## T35 — Consistency pass + visual regression
- Sweep remaining surfaces (PhaserGame overlays, OfflineBanner, LoadingSkeleton, toasts,
  HUD connection dot, MatchTV ticker) for any non-token color/radius/emoji; align to tokens.
- Add a Playwright visual-regression check (or DOM-snapshot) per surface so future drift
  fails CI. Document baseline-update process.
- Anti-AI-pattern check (design-spec §): no centered-everything, no generic SaaS cards,
  no purple gradients — REJECT if present.
