# Visual regression & design-drift guard | v1.0.0 | 2026-06-13

T35 adds two browser-free checks that keep every UI surface aligned with
[`design-spec.md`](./design-spec.md) and fail CI on drift. They run as part of
the normal frontend test suite (`pnpm --filter frontend test`) — no chromium or
Playwright required in the build sandbox.

## 1. Design-drift guard — `apps/frontend/test/designDrift.test.ts`

A static scan of every `*.ts(x)` under `src/components`. Comments are stripped
first, so documentation may freely mention hex/emoji. It fails if a surface
contains:

| Check | Rule (design-spec) |
|-------|--------------------|
| Raw hex colour | §2 — every colour must come from `styles/tokens.ts` |
| Emoji icon | §4 / §7 — FORBIDDEN. Unicode box-drawing / geometric glyphs (`■ ▶ ▾ ▲ ✓ ✗ ✕ → …`) are allowed |
| Non-zero `border-radius` | §4 — `border-radius: 0` everywhere |
| Gradient / glassmorphism / `backdrop-filter` | §7 — "generic AI" tells |

**To fix a failure:** change the source (move the colour into `tokens.ts`,
replace the emoji with a unicode glyph or pixel sprite, drop the radius, remove
the gradient). There is no baseline to update.

## 2. DOM contract — `apps/frontend/test/surfaceContract.test.tsx`

jsdom renders each presentational surface (RankMedal, OfflineBanner,
LoadingSkeleton, MatchTV) and asserts its **visual contract**: design-token
colours (`getComputedStyle`), pixel rules (`border-radius: 0`), required
glyphs/labels, and the hard rule that no emoji reaches the rendered DOM.

> Note: Vitest's `toMatchSnapshot` is unavailable in this repo (`globals: false`
> trips a known v3 snapshot-client bug), so the contract is pinned with explicit
> assertions rather than a `.snap` baseline. The assertions *are* the baseline.

### Updating the contract (intentional visual change)

1. Make the UI change and review it against `design-spec.md`.
2. Attach **before/after screenshots** to the PR (design-spec hard rule).
3. Update the matching assertion in `surfaceContract.test.tsx` (e.g. the new
   token colour) and describe the visual change in the PR.

Never relax an assertion just to make a red test green without confirming the
change is intentional — that is exactly the drift these checks exist to catch.

## Adding a new surface

- Add a `describe` block to `surfaceContract.test.tsx` (mock any `@/lib/api`
  calls — see the `vi.mock` for MatchTV).
- The drift guard picks up new files automatically — no wiring needed.
