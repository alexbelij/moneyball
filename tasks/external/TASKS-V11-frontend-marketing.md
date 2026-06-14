# TASKS-V11 — Frontend / A11y / SEO / Marketing remediation + strategic features

> Author: Lead Viktor · 2026-06-14 · Base: `main` 153a12a
> Driver: Anna's frontend + marketing review (14.06). Audit before this missed
> pixel-level UX / a11y / SEO — this pack closes those gaps and adds the
> jury-facing polish + strategic narrative features.
>
> **Jury is English-speaking. Deadline 24.06. Priority order is strict.**
>
> Workflow reminder for the implementing agent:
> - Each task = its own branch `task/T<NN>-<slug>`, opened from latest `main`.
> - Do NOT commit `test-results/` or `playwright-report/` (add to .gitignore if missing).
> - All work must keep green: `apps/frontend` vitest + tsc, `apps/backend` vitest + tsc,
>   and `designDrift.test.ts` (T35 token guard — no raw hex in `src/components/`).
> - Lead Viktor reviews every branch by running it himself before merge.

---

## P0 — JURY-FACING BLOCKERS (must ship before judging)

### T45 — Translate agent persona content to English (default = jury language)
**Why:** `apps/backend/src/agents/agent-config.v1.json` holds ALL agent
`personality`, `catchphrases`, `roastLines`, and `thoughtBubbles` in **Russian**.
This file drives the live `/api/roast` ("Roast me" / "Disagree" buttons) and
`/api/public/agents/:id/thoughts` (room thought bubbles). Right now a juror who
clicks "Roast me" gets Russian text. The whole on-screen agent voice must be English.

**Scope:**
- Translate every Cyrillic string in `agent-config.v1.json` to natural, in-character
  English (5 agents: dr_morgan, scout_alvarez, viktor_kane, sofia_mendes, madame_pythia).
  Keep each agent's distinct voice (Morgan = cold/quant, Alvarez = scout/instinct,
  Kane = contrarian, Mendes = data-poet, Pythia = mystic). Preserve JSON structure,
  array lengths, and all keys (`evolution_trigger`, `thoughtBubbles` states, etc.).
- The ambient socket-thought loop in `apps/backend/src/index.ts` (~line 142) is already
  English but fires **every 1000ms** — slow it to a calmer cadence (e.g. 7–12s, jittered)
  and source those lines from the persona `thoughtBubbles` so there is ONE voice system,
  not two competing ones. Keep deterministic-friendly (no hard RNG dependency in tests).
**Acceptance:** `grep -rP '[\x{0400}-\x{04FF}]' apps/backend/src` returns nothing.
Roast + thoughts endpoints return English. Backend tests + tsc green.

### T46 — Fix contrast / readability tokens (WCAG AA)
**Why:** measured on the modal bg `#181009`:
- `text.muted = #4e2912` → **1.48:1** (labels "Status:", role, "Last thought:", meta
  timestamps, hints) — effectively invisible, fails AA (needs 4.5:1).
- `text.faint = #876845` → **3.67:1** — fails body, passes large only.
This is the "colours merge with background" complaint, and it's objectively true.

**Scope (`apps/frontend/src/styles/tokens.ts`):**
- Raise `text.muted` to a value with ≥4.5:1 on both `wood900 #181009` and `surface #0c0c0c`
  (e.g. a warm tan ~`#b89a6a` ≈ 6:1 — verify with a script, don't eyeball).
- Raise `text.faint` to ≥4.5:1 for body use (or restrict it to ≥18px/bold large-text only
  and document that).
- Add a tiny dev helper script `apps/frontend/scripts/contrast-check.ts` that asserts every
  text token ≥4.5:1 on `wood900` and `surface`; wire a vitest that fails CI on regression.
- Audit any per-agent accent used as TEXT on dark (e.g. `dr_morgan #e8a44a` ok, check all 5).
**Acceptance:** contrast vitest green; no token <4.5:1 for body text; designDrift still green.

### T47 — SEO / SMM `<head>` + favicon + microdata
**Why:** `apps/frontend/index.html` head has only `<title>`. No description, Open Graph,
Twitter card, favicon, theme-color, canonical, or JSON-LD. Bad for sharing + judging polish.

**Scope:**
- Add to `index.html` head: `<meta name="description">`, canonical, `theme-color`,
  Open Graph (`og:title/description/image/url/type`), Twitter (`summary_large_image`),
  and a JSON-LD `<script type="application/ld+json">` describing the app
  (`SoftwareApplication` / `WebSite`).
- Add a pixel-art **favicon** (svg + 32×32 png + apple-touch-icon) into `public/` and link it.
  Reuse the room/agent pixel aesthetic.
- Produce an OG share image (1200×630) under `public/` (a clean cabinet hero still + title).
  If you can't generate art, leave a TODO and ping lead — lead can generate the image.
- Sanity-check `public/robots.txt` + `public/sitemap.xml` reflect the real Walrus URL
  (`https://taken.wal.app`).
**Acceptance:** head validates; favicon shows in tab; OG/Twitter tags present; build green.

---

## P1 — UX / MODAL / RESPONSIVENESS

### T48 — AgentModal: sidebar → proper game dialog (75–80% width, blur, scene pause)
**Why:** `apps/frontend/src/components/AgentModal.tsx` renders a **fixed 440px right
sidebar** (`width: 440`, `justifyContent: flex-end`, `borderLeft`). It already has
`role="dialog"`, `aria-modal`, focus trap (`trapRef`), and scrim — good — but the spec
wanted a centered **modal at 75–80% viewport width**, **backdrop blur**, **pausing the
Phaser scene** while open (resource saving), and a framed "game dialog" look.

**Scope:**
- Re-layout as a centered modal: `min(80vw, 980px)` width, `max-height: 86vh`, centered,
  responsive (full-width with margins on narrow screens — see T49). Keep the existing
  tabs/content; just change the shell. Consider reusing `ui/PixelModal.tsx`.
- Backdrop: keep the scrim AND add `backdrop-filter: blur(4–6px)` (with a no-blur fallback
  for `prefers-reduced-motion` / unsupported).
- **Pause Phaser** while modal is open: emit a `GameEventBus` event (e.g. `scene:pause` /
  `scene:resume`) and have `CabinetScene` call `scene.pause()` / `this.scene.resume()` (or
  stop ambient tweens/timers) so the game loop idles behind the modal. Resume on close.
- Game-dialog framing: SNES bevel border (`shadows.hard`), header bar, clear close button,
  consistent padding from `spacing`. No raw hex (use tokens → designDrift stays green).
- Keep focus trap + Esc-to-close + restore focus to the triggering agent on close.
**Acceptance:** modal is ~80vw, blurred+paused background, framed; a11y intact; FE tests green.

### T49 — Responsiveness + typography pass (adaptivity skill)
**Why:** fixed `440` px and several `fontSize: 12` Press Start 2P labels (pixel font at 12px
is hard to read); inter-line spacing/weights are inconsistent. Not responsive on small screens.

**Scope:**
- Establish a small responsive scale in `tokens.ts` (e.g. `fontSize` ramp + `lineHeight`
  tokens) and apply across `AgentModal`, `HUD`, `StatsBoard`, `MatchTV`.
- Reserve `Press Start 2P` for short headers only (never long body / never <12px); use
  `VT323` for body/data and bump body to ≥16px with comfortable line-height.
- Make the cabinet/HUD usable down to ~360px width (modal full-width, stack tabs, scrollable).
  Add `@media` rules / clamp() where needed. Verify with a quick Playwright screenshot at
  375×667 and 1440×900 (do NOT commit the artifacts).
**Acceptance:** legible at 12px-free body, no horizontal overflow at 360–1440px; tests green.

---

## P2 — DELIGHT / NARRATIVE

### T50 — Developer console easter-egg + styled logs + football-quote library
**Why:** Anna wants a message for devs who open the console, pretty log output, and a random
football quote/joke on load (library of 20–50).

**Scope:**
- New `apps/frontend/src/lib/devConsole.ts`: on boot, print a styled banner (CSS `%c`)
  welcoming devs, linking the repo / "deploy your own agent" (see T52), and a `console.table`
  of the live agents. Gate behind a one-time call from `main.tsx`.
- New `apps/frontend/src/lib/footballQuotes.ts`: 30–50 curated **English** football quotes
  (Cruyff, Shankly, Mourinho, Wenger, Klopp, etc.) + a deterministic-or-random picker.
  Surface one in the console banner and (optional) as a subtle footer/loading line.
  Verify quotes are real/attributed — don't fabricate.
**Acceptance:** opening console shows the banner + a quote; unit test for the picker; tests green.

### T51 — In-app navigation / menu (About · How it works · Docs · Verify on Walrus)
**Why:** there is no top-level menu; everything lives inside the agent modal. Jury can't find
"what is this / how memory works / where's the proof".

**Decision (recommended):** do NOT add a heavy router that reloads the Phaser scene. Keep the
single cabinet scene and open lightweight **overlay panels** (same modal shell as T48) from a
small pixel **menu button / top bar**. Use hash routes (`#/about`, `#/how-it-works`) only for
deep-linkable share URLs that open the matching overlay — no scene reload.
**Sections to ship:** `About` (the pitch + Walrus Memory World Cup framing), `How it works`
(the day1→dayN memory loop, with a link to the Day1-vs-Now panel), `Methodology` (already per
agent), `Verify on Walrus` (blob/object links — ties to T37 if present), `Leaderboard`.
**Acceptance:** menu button opens overlays; hash deep-links work; a11y (focus trap) reused.

---

## P3 — STRATEGIC / ECOSYSTEM (scope-gated — design doc first, ping lead before building)

### T52 — "Deploy your agent to the Hive" — Agent Memory SDK (concept + thin slice)
**Narrative:** strongest Walrus story = let other devs **deploy their own agent persona into
the Hive** and get persistent, evolving memory on Walrus out of the box. Great for C2
(Creativity) and the ecosystem pitch.
**Step 1 (this pack):** a **design doc** `docs/agent-sdk-design.md` only — define the
`AgentConfig` schema (persona + methodology + seed libraries, mirroring agent-config.v1.json),
the public ingest endpoint shape, and how memory persists/evolves via the existing MemWal +
read-model. Then STOP and ping lead for go/no-go on a thin implementation slice before the
deadline. Do NOT build the full SDK without sign-off.

### T53 — Inter-agent interaction (agents reference each other)
**Today:** agents do NOT talk to each other — each only emits independent ambient thoughts.
**Opportunity:** let agents occasionally **react to a rival's prediction** ("Pythia's omen
disagrees with my xG by 0.6 goals…") — a cheap deterministic cross-reference using existing
predictions, no LLM required. Big authenticity/flair win.
**Step 1 (this pack):** design doc `docs/inter-agent-design.md` (data source = existing
per-agent predictions; deterministic pairing/templating; where it surfaces — thought bubbles
or a "Cabinet chatter" ticker). STOP and ping lead before implementing.

---

## Lead-Viktor track (I handle these, not the implementing agent)
- L5: generate favicon + OG share image art if T47 needs it.
- L6: after any merge to `main` → re-seed prod + warm (ephemeral-disk rule).
- L7: write any LLM keys into Render (kept off the implementing agent).
- L8: final pre-judging re-seed + warm + smoke test of taken.wal.app.
