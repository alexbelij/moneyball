# TASKS-V12 — Full P0–P2 remediation + UX-robustness layer (toasts / loading / error handling)

> Author: Lead Viktor · 2026-06-14 · Base: `main` `d5fb181` (P0/P1 V11 deployed & live)
> Driver: Anna's 11-perspective critique (14.06) + her new UX requirements (14.06 23:42).
> **We have ~1 week (deadline 24.06). Jury is English-speaking. Implement the whole P0–P2 burn-down in strict priority order.**
>
> Workflow reminder for the implementing agent (second Viktor):
> - Each task = its own branch `task/T<NN>-<slug>`, opened from latest `main`.
> - Do NOT commit `test-results/` or `playwright-report/` (add to `.gitignore` if missing).
> - Keep green on every branch: `apps/frontend` vitest + tsc, `apps/backend` vitest + tsc,
>   `designDrift.test.ts` (no raw hex in `src/components/` — use `tokens.ts`), and the WCAG
>   contrast guard (T46). No Cyrillic in UI or API output: `grep -rP '[\x{0400}-\x{04FF}]' apps/{frontend,backend}/src` must be empty.
> - Lead Viktor runs and reviews every branch himself before merge. Send precise PR notes.
> - Generate any required images with YOUR OWN image tools (Anna's rule — keep lead's credit pool free). Match the SNES dark-wood-cabinet pixel aesthetic. No placeholders.
>
> **Still-open from V11 (do these too, same priority bucket as noted): T50, T51, T52, T53, T54, T55.**

---

## PRIORITY ORDER FOR THE WEEK (strict — burn down top to bottom)

**P0 — jury-critical + catastrophic-risk (ship first):**
- `T57` read-model durability (memory must survive redeploy) · `T56` security hardening
- `T68` global error handling + error boundary (errors never white-screen / never break layout)

**P1 — robustness + polish the jury & users feel:**
- `T66` pixel toast / push-notification system · `T67` async blocking-states + skeleton loaders
- `T55` memory-aware chat · `T51` in-app menu · `T64` verifiability surface
- `T59` onboarding + guest read-only · `T63` "what memory changes" explainer · `T65` CI gate

**P2 — differentiator + extra polish (only if time remains):**
- `T52`–`T54` Agent Memory SDK / Hive / external-agent (ecosystem marquee — heavy scope, the "cherry")
- `T58` frontend perf · `T61` shareable roast card · `T50` console easter-egg

> If the week runs short, the ecosystem trio (T52–T54) slips before anything in P0/P1.
> **Lead Viktor takes directly (NOT in this dev pack): T60 demo video + hero + Airtable submit, T62 business/vision one-pager in README.** Coordinate timing — the video records the finished UI, so it's the last lead step.

---

# P0

## T56 — Security hardening (backend)
**Why (by code):**
- `apps/backend/src/config/env.ts:18` — `JWT_SECRET: process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me'`. If prod env is ever unset, anyone forges an admin JWT. Render has it set, but there is no fail-fast.
- `apps/backend/src/index.ts:57` — `express.json()` with no size limit → DoS via huge body.
- `apps/backend/src/index.ts:42` — CORS allows requests with **no Origin** (curl/server-to-server bypass the allowlist).
- nonce-store + `util/rateLimit.ts` SimpleRateLimiter are **in-memory** (reset on redeploy, per-instance). No `helmet`/security headers.

**Scope:**
- **Fail-fast** in `env.ts`: if `NODE_ENV==='production'` and `JWT_SECRET` is missing/equals the dev fallback → `throw` on boot (do not start). Keep the dev fallback only for non-prod.
- `express.json({ limit: '64kb' })` (pick a sane cap; payloads are tiny). Add `express.urlencoded` limit if used.
- Tighten CORS: keep public GETs open, but **reject no-Origin requests for mutating methods** (POST/PUT/PATCH/DELETE) unless from the allowlist. Document the decision in a comment.
- Add `helmet()` with a CSP compatible with the Walrus-hosted frontend (allow the backend origin, websocket, and inline pixel styles if needed — test the live site doesn't break).
- Review nonce + rate-limit: at minimum document the in-memory/per-instance limitation; if cheap, add a short TTL sweep so the store can't grow unbounded. (No durable store needed for the hackathon — Render runs single instance.)
- `npm/pnpm audit` (or `pnpm audit --prod`) — fix any high/critical that's a one-line bump.
**Keep as-is (already good):** SIWE-style nonce + canonical message + Sui signature verify, strict HS256 JWT (alg-confusion safe), `requireAdmin` allowlist/role, secrets in env.
**Acceptance:** boot throws in prod-mode without a real secret; oversized body → 413; no-Origin mutation → blocked; helmet headers present; live site still works; backend vitest + tsc green.

## T57 — Read-model durability: memory must survive a redeploy (backend) — TOP RISK
**Why:** the read-model index lives in-memory + ephemeral Render disk (`.data/agent-index.json`), which wipes on every redeploy/cold start. boot-hydrate from MemWal is best-effort and unreliable → today we **manually re-seed prod after every deploy**. For a product *about memory*, this is the #1 risk during judging.
**Invariant to preserve:** MemWal stays the durable source of truth. We are fixing the **read-model** layer on top of it, not adding a second SoT.
**Scope (pick the most reliable that fits — discuss with lead if unsure):**
- **Make boot-rehydrate reliable**: on startup, fully rebuild the read-model index from MemWal (replay all prediction/evolution events deterministically) so a cold start reproduces the exact same reads as a fresh seed — verify 5 consecutive reads are identical after a simulated cold start. **This is the preferred fix** (keeps MemWal as SoT, no external infra).
- AND/OR **seed-on-boot guard**: if after rehydrate the index is empty/short, auto-run the idempotent seeder logic once (no manual step). Must be idempotent by `predictionId` and not duplicate evolution snapshots.
- Optional: if Render persistent disk is trivial to attach, mount `.data` to it as belt-and-suspenders — but rehydrate must still work without it.
- Add a `GET /health` (or extend existing) detail that reports index size / readiness so we can verify warmth before judging.
**Acceptance:** simulate a cold start (wipe `.data`, restart) → reads are deterministic and match the seeded baseline WITHOUT any manual re-seed (dr_morgan/scout/viktor = 3 evo / 16 pred; sofia/pythia = 2 / 16). vitest covers the rehydrate path; tsc green. **This task is what lets us stop babysitting the demo.**

## T68 — Global error handling & resilience (frontend + small backend slice)
**Anna's requirement (14.06):** errors must NOT block the interface and must be handled; errors must NOT break the layout; non-form errors → a self-dismissing push toast (top corner); a React error boundary so a crash never white-screens. Form errors stay inline.
**Scope:**
- **Backend error contract (small slice, coordinates with T56):** ensure every route returns a consistent JSON shape `{ error: { code: string, message: string } }` with the right status (400/401/404/413/429/500), never leaks stack traces. Add a global Express error handler if missing.
- **API client wrapper** (`apps/frontend/src/lib/api.ts` or existing client): central fetch with timeout, parses the error envelope, detects network/offline (tie into the existing T41 `OfflineBanner` waking-state), maps failures to friendly English messages. Returns a `Result`-style value so **form** callers handle errors inline, while **non-form** failures auto-route to a toast via `toastBus` (T66).
- **React error boundaries:** a **root** boundary + boundaries around heavy widgets (Phaser canvas, `AgentModal`). On crash → a friendly pixel fallback panel ("Something glitched — reload this panel") with a retry, NOT a white screen; log to console. (This **supersedes** the error-boundary item that was inside T58 — T68 owns it; T58 just references it.)
- **Layout safety:** all error/empty/loading states use reserved space, `max-width`, and overflow handling so they never push or break the pixel layout. Long text wraps or scrolls. Empty states get pixel placeholders.
**Acceptance:** kill the backend → app shows toasts + offline banner, no white screen, layout intact; `throw` inside a child component → boundary fallback shows while the rest of the app stays alive; form validation errors render inline (not as toast); vitest where feasible; tests green.

---

# P1

## T66 — Pixel "coach dialogue" toast / push-notification system (frontend) — Anna's design
**Anna's brief (14.06):** stylised push-notifications — a **rounded-corner rectangle in the SNES/Sui pixel style**; **left = pixel coach avatar**, **right = the error/notification text**; **fixed height matched to the avatar**, **fixed width (~180–250px)**; the **text sits in a vertically-scrollable div** — like reading player dialogue in a game. Pops in a top corner, self-dismisses.

**Exact spec (use these numbers; adjust only with lead sign-off):**
- **Container:** width `240px` (within Anna's 180–250 range; gives a readable text column). SNES bevel via `shadows.hard` + small `border-radius` (~5px) for the "rounded pixel corner" look. Tokens-only colours (designDrift green).
- **Avatar:** `56×56px` pixel coach portrait on the left, `image-rendering: pixelated`, framed. Box height = avatar + vertical padding ≈ **`76px` fixed**.
- **Text column:** the remaining width (~150px), `max-height` = avatar height, `overflow-y: auto` with a **thin pixel scrollbar**, `VT323` body font, comfortable size. Optional small bold title line (agent/system name) above the message. This is the "reading game dialogue" feel.
- **Coach selection:** agent-specific events use that agent's portrait (dr_morgan / scout_alvarez / viktor_kane / sofia_mendes / madame_pythia — reuse existing portrait/sprite assets). System/global errors use a default **system "announcer" avatar** — if none exists, generate one pixel avatar on-brand (you generate it).
- **Variants:** `error` (red accent frame/edge), `success` (green), `info` (amber/gold default), `warning`. Accent only via tokens; add the variant colours to `tokens.ts` if missing.
- **Placement:** fixed stack **top-right** (`top:16px; right:16px`, 8px gap between toasts). Top-right is the standard best practice and reads well over the dark cabinet — going with that (Anna's "справа сверху/снизу сверху" left the exact corner open). `z-index` above the modal scrim (e.g. modals ~1000 → toasts ~1100). Max **3 visible**, rest queued FIFO.
- **Lifetime:** auto-dismiss — info/success `4500ms`, error/warning `7000ms`; **pause on hover/focus**; manual close (small pixel ✕); optional thin pixel progress bar ticking down at the bottom.
- **Motion:** slide-in from the right + fade `~180ms`, slide-out on dismiss; **respect `prefers-reduced-motion`** (fade or instant). Use the motion/spring tokens if present.
- **a11y:** wrap the stack in an `aria-live` region — `error` → `role="alert"` / assertive, others → `role="status"` / polite. Close button has `aria-label`. Never trap focus (non-modal). Dismiss focused toast on Esc.

**API:**
- `ToastProvider` mounted once at the app root.
- `useToast()` → `toast.error(message, opts) | toast.success | toast.info | toast.warning`, where `opts = { coach?: AgentId | 'system'; title?; durationMs?; sticky? }`.
- A module-level `toastBus` (tiny event emitter) so **non-component code** (the T68 API client) can fire toasts; `ToastProvider` subscribes to it.
- No new heavy deps — a small reducer + emitter is enough.
**Files:** `apps/frontend/src/components/toast/{ToastProvider,Toast}.tsx`, `toastBus.ts`, `useToast.ts`. Wire `ToastProvider` in `main.tsx`/`App`.
**Acceptance:** firing each variant shows a correctly-styled pixel toast top-right with the coach avatar + scrollable text, auto-dismisses, pauses on hover, stacks/queues, respects reduced-motion, and is the single sink for non-form errors (T68). vitest with fake timers covers queue add/dismiss/max-visible/auto-dismiss + role mapping. designDrift + tests green.

## T67 — Async blocking-states + skeleton loaders (frontend) — Anna's requirement
**Anna's requirement (14.06):** if an object (button, table row, etc.) is awaiting a result after a click, it must **not be clickable** — block it + show a loading animation until the result returns (success or error). Add **skeletons** for loading data.
**Scope:**
- **`useAsyncAction(asyncFn, { onError: 'toast' | 'inline' })`** hook → `{ run, pending, error }`. While `pending`: ignore re-entry (kills double-submit). On error: `'toast'` → fire via `toastBus` (T66); `'inline'` → expose `error` for form display. Always reset in `finally`.
- **Busy button:** extend the existing pixel button (or add `<PixelButton busy>`): when busy → `disabled`, `aria-busy=true`, `pointer-events:none`, shows an inline **pixel spinner** in place of / before the label, and **reserves width so there is no layout shift**.
- **`Spinner`** — small SNES-style pixel loading animation; respects `prefers-reduced-motion` (static frame / simple).
- **`Skeleton`** — pixel shimmer placeholder with variants (text line, block, avatar, table row). Use in `StatsBoard`, leaderboard, agent lists, `MatchTV`, and any fetch-backed panel **while loading**, with dimensions matching real content (no CLS).
- **Apply the contract across all async surfaces:** "Roast me" / "Disagree", wallet connect, prediction submit, chat send (T55), and every data-loading panel → skeleton. Every async click guarded by the pending flag.
**Acceptance:** clicking any async control disables it + shows the spinner until it resolves; impossible to double-fire; data panels show skeletons during load with no layout shift; vitest covers `useAsyncAction` (pending lifecycle, re-entry guard, error routing); tests green.

## T55 — Memory-aware LLM chat (carryover from V11/T31 STEP 2)
See V11 spec — unchanged. Do AFTER T45 (English persona, already merged). Route `POST /api/agents/:agentId/chat`, memory-aware in-character English, behind `LLMClient` with deterministic fallback (keys go to Render by lead, never to you), no durable write from free chat, numbers always from the deterministic engine. **Wire the chat send button through T67 (busy state) and chat errors through T66 (toast).**

## T51 — In-app menu (About · How it works · Verify on Walrus · …) — see V11
Unchanged from V11. Overlay panels (no scene reload), hash deep-links, EVERY section has real content. The `Verify on Walrus` section is the natural home for T64's blob/object links.

## T64 — Verifiability surface (frontend + thin backend read)
**Why:** "everything's on Walrus mainnet" is currently just words — no visible blob IDs / on-chain links a juror can check themselves. Walrus/Mysten judges reward provable on-chain usage; the rules also reward substantive feedback (Best Feedback prize).
**Scope:**
- Surface, in the `Verify on Walrus` menu section (T51) and/or each agent's panel, the **real MemWal blob IDs / Sui object IDs** behind an agent's memory, as copyable values + links to a Walrus/Sui explorer. Pull from whatever MemWal write returns (object/blob refs); add a small read endpoint if needed (no new durable schema).
- A short "How to verify" note: what the juror is looking at and why it proves persistent memory.
- Open **2–3 substantive GitHub issues** against the relevant Walrus/Mysten repos (real bugs/feedback you hit using Walrus/site-builder/SDK during this project) — concrete, reproducible, useful. Link them from the About/Methodology section. (Best Feedback prize.) Draft the issue text and send to lead for a quick check before posting.
**Acceptance:** UI shows real, checkable blob/object IDs with working explorer links; the verify note is accurate; issue drafts ready for lead review; tests green.

## T59 — Onboarding overlay + guest read-only mode (frontend)
**Why:** first screen is a pixel room with no explanation, and the strongest feature (personal roast) sits behind a Sui wallet 99% of viewers don't have.
**Scope:**
- A dismissible **first-run guided overlay**: "what this is → click a coach → open their dossier → see how they changed (Day1 vs Now)". 3–4 steps, pixel-styled, skippable, remembered in `localStorage`.
- A **guest read-only mode**: without a wallet, let visitors explore agents, dossiers, leaderboard, and a **demo memory** (a sample agent's before/after) so the memory story lands without connecting. Make the wallet-gated bits clearly say "connect to make it remember YOU".
**Acceptance:** first visit shows the overlay once; guests can explore + see a demo before/after with no wallet; wallet-gated actions are clearly labelled; a11y (focus order) intact; tests green.

## T63 — "What memory actually changes" explainer + honest roadmap (frontend content)
**Why:** a skeptical engineer-juror sees `teamStrength = hash(name)` and deterministic nudging and asks "where's the AI?". Get ahead of it honestly.
**Scope:**
- A small in-UI explainer (in `How it works` / agent panel): in plain English, **what memory concretely changes** — confidence calibration, hedging, topic/matchup multipliers — and that numbers are **deterministic & verifiable** by design (authenticity over model-accuracy). One honest line that synthetic inputs are clearly badged and Brier is computed on **real match outcomes**.
- A short **roadmap** line: path from hash-based inputs → real features (xG/form) as V2. No overclaiming.
**Acceptance:** explainer is accurate, English, on-brand, links to the Day1-vs-Now panel; designDrift + tests green.

## T65 — CI quality gate + toolchain docs (repo)
**Why:** artifacts (`test-results/`, `playwright-report/`) and Cyrillic leaks are caught by hand today; tribal toolchain knowledge isn't in the repo.
**Scope:**
- CI workflow (GitHub Actions) that on PR runs: FE vitest+tsc, BE vitest+tsc, `designDrift`, the T46 contrast guard, a **Cyrillic scan** of `apps/*/src`, and **fails if `test-results/` or `playwright-report/` are committed**. Add a prod **smoke test** step (hit `/health` + a public read endpoint) that can run post-deploy.
- Ensure `.gitignore` covers the artifact dirs.
- `docs/TOOLCHAIN.md`: pnpm@9.12.0, bun caveats (bun breaks vitest), the `jsonwebtoken` symlink, "run vite from `apps/frontend`", the re-seed command, the Walrus `update` flow. Pull the real commands from how lead actually deploys.
**Acceptance:** CI green on a clean PR and red when an artifact dir or Cyrillic is added; smoke step works; TOOLCHAIN.md is accurate.

---

# P2 — differentiator + extra polish (only if the week allows)

## T52 / T53 / T54 — Agent Memory SDK + Hive + external-agent — see V11 (unchanged)
The ecosystem marquee (two-step: `docs/*-design.md` → lead GO → thin implementation slice). Highest creativity/tech upside but heaviest scope — keep as the "cherry", do not let it eat P0/P1. Connected-agent text must be escaped (XSS) and can never write numbers into our deterministic engine. Wire its buttons through T67 and its errors through T66.

## T58 — Frontend performance pass
**Scope:** `React.lazy` + `Suspense` for the Phaser/editor chunks (vendor-phaser is 1.48MB / 339KB gzip, loaded synchronously); extract/`useMemo` the repeated inline `style={{…}}` objects (new refs every render → extra re-renders, esp. modal/tables); `React.memo` heavy components. **Error boundary now lives in T68** — just consume it here. Run a bundle-analyze and report wins.
**Acceptance:** Phaser loads lazily, measurable bundle/CLS improvement, no behaviour change; tests green.

## T61 — Shareable personal roast card (frontend + small endpoint)
**Scope:** a dynamic **OG image** of a user's personal roast ("here's how the cabinet roasted YOUR wallet") + a Share button. Either a serverless/edge OG-render or a pre-rendered canvas → image. On-brand pixel card. Optionally 2–3 short social clips (lead may take the clips). Make it the viral object the marketer perspective wanted.
**Acceptance:** share produces a correct, on-brand card image for a given agent/roast; tests where feasible.

## T50 — Console easter-egg + styled logs + football-quote library — see V11 (unchanged)

---

## Notes / cross-references
- **T68 owns the React error boundary** (was duplicated in T58). **T66 is the single sink for non-form errors**; **T67** routes async errors to it. Build order within the UX trio: **T66 → T67 → T68** (toast first, then async states use it, then global handler wires everything).
- Reuse existing shells: `ui/PixelModal.tsx` (overlays), `OfflineBanner` (T41, offline state), agent portrait assets (toast avatars), `tokens.ts` (all colours), `GameEventBus` (scene pause).
- Memory invariant everywhere: any displayed number comes from the deterministic engine, never from chat/LLM/external text.
- After any merge to `main`, Render redeploys → if T57 isn't in yet, lead must re-seed. Once T57 lands, that ritual should be gone — call it out in your T57 PR.
