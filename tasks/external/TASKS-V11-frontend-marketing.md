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
- Produce an OG share image (1200×630) under `public/` (a clean cabinet hero still + title)
  AND the pixel favicon set. **You generate these images yourself** using your own image
  tools (Anna's instruction — keep lead's credit pool free). Match the room/agent pixel
  aesthetic (dark wood cabinet, warm amber, SNES bevel). Deliverables committed to `public/`:
  `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` (180×180), `og-image.png` (1200×630).
  Optimise PNGs (≤200 KB). If a generated asset looks off-brand, iterate before committing —
  do NOT ship a placeholder.
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

### T55 — Finish T31 STEP 2: memory-aware LLM chat with agents (carryover from V10)
**Status:** the chat design doc was already accepted in V10 (`task/T31-chat`). STEP 1 landed;
STEP 2 (the actual LLM chat) is still **optional polish — NOT a jury blocker**, so it ranks
below the P0 blockers. It IS backend work, so it can proceed in parallel with the frontend P0.
**Dependency:** do it AFTER T45 (English persona) — the chat must speak the same English voice.
**Scope:**
- Route `POST /api/agents/:agentId/chat`; 404 on unknown agentId; trim history; temp ~0.5.
- Memory-aware in character: "connect your wallet so I remember you" + roast sourced from the
  MemWal summary; **football-only persona**, deflect off-topic in-character.
- Behind `LLMClient` with a **deterministic fallback** so CI stays green WITHOUT a key (keys go
  into Render by lead, never to the implementing agent). NO new durable schema and NO durable
  write from free chat (Sui write stays only via the existing "Disagree" button).
- Keep the memory invariant: any number stays from the deterministic engine, never from chat text.
**Acceptance:** chat endpoint returns in-character English; deterministic fallback path tested;
backend vitest + tsc green; no Cyrillic.
**Priority note:** if time is tight before 24.06, the ecosystem demo (T52–T54) and P0 outrank this.

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
agent), `Verify on Walrus` (blob/object links — ties to T37 if present), `Leaderboard`,
`Connected agents` (T54).
**Anna 14.06:** EVERY section must have REAL content — an empty/placeholder section is worse than
no section. Do NOT invent extra menu items; add a new section ONLY if there is concrete content
that none of the above covers (then propose it to lead first). Ship only the sections you can fill.
**Acceptance:** every shipped section has real content; menu button opens overlays; hash deep-links
work; a11y (focus trap) reused.

---

## P2 — STRATEGIC / ECOSYSTEM (Anna 14.06: SDK is IN the build plan, not just a doc)

> These three are the ecosystem story for the jury (C2 Creativity + C3 Tech). Each is a
> **two-step marquee feature**: ship `docs/<slug>-design.md` FIRST on a `*-design` branch →
> lead reviews → then implementation branch. The design step is fast (hours), NOT a reason to
> defer — Anna wants a working **thin slice live** before judging, not a slideware doc.

### T52 — Agent Memory SDK + "Hive" registry (BUILD a thin slice)
**Narrative:** strongest Walrus story = other devs **deploy their own agent persona into the
Hive** and get persistent, evolving memory on Walrus out of the box (we already have MemWal +
the deterministic read-model under it).

**Step 1 — design doc `docs/agent-sdk-design.md`:** define
- `AgentConfig` schema (persona + methodology + seed libraries, mirroring
  `agent-config.v1.json`): `id`, `displayName`, `persona`, `methodology`, `catchphrases`,
  `seedPredictions?`, `owner` (Sui address), `source: "connected"`.
- **`AgentRegistry`** abstraction holding BOTH built-in (`source:"core"`) and registered
  (`source:"connected"`) agents — today the 5 agents are hardcoded with no `GET /api/public/agents`
  listing route; the registry adds one.
- Ingest endpoint shape `POST /api/hive/agents` (auth = Sui address / signed payload; rate-limited)
  and how a connected agent's memory persists/evolves through the EXISTING MemWal + read-model
  (no new durable schema — reuse `AgentEventService` keyed by the new agentId).
- The minimal TS SDK surface in a new workspace package `packages/agent-sdk`:
  `defineAgent(config)`, `connect({ baseUrl, signer })`, `submitPrediction(matchId, pick, confidence)`.

**Step 2 — thin implementation slice (after lead GO):**
- `AgentRegistry` + `GET /api/public/agents` returning core + connected agents with `source` flag.
- `POST /api/hive/agents` register endpoint (validate config, assign agentId, persist registry
  entry, wire into `AgentEventService` so its predictions/evolution flow through the same
  read-model + MemWal). vitest: register → appears in list → submit prediction → readable back
  deterministically.
- `packages/agent-sdk` package with the 3 functions above + a runnable **example**
  `examples/sample-agent.ts` that registers a demo persona and posts one prediction. This is the
  "deploy your own agent" demo for the pitch.
**Acceptance:** sample agent registers, shows in `/api/public/agents` as `connected`, its prediction
is readable via the public read-model; backend+SDK vitest + tsc green.

### T53 — Inter-agent interaction (agents reference each other) — BUILD
**Today:** agents do NOT talk to each other — each only emits independent ambient thoughts
(`index.ts` ~line 142, 1 s loop). **Opportunity:** agents occasionally **react to a rival's
prediction** ("Pythia's omen disagrees with my xG by 0.6 goals…") — cheap, deterministic
cross-reference over existing predictions, **no LLM required**. Big authenticity/flair win (C1+C2).

**Step 1 — design doc `docs/inter-agent-design.md`:** data source = existing per-agent
predictions on the same match; deterministic pairing (e.g. stable sort by agentId, pick the
biggest confidence/pick divergence); deterministic templating per persona; surface = thought
bubbles AND/OR a "Cabinet chatter" ticker. Define how it stays test-stable (no RNG).
**Step 2 — implementation (after lead GO):** a pure `lib/cabinetChatter.ts` builder (vitest:
same fixtures → identical lines) feeding the ambient thought system unified in T45. Connected
agents (T52) are first-class participants here.
**Acceptance:** deterministic chatter lines reference real rival predictions; vitest green.

### T54 — Connect an EXTERNAL agent into the conversation + "Connected" list (BUILD)
**Anna 14.06:** add functions so a **third-party / external agent** can connect and talk WITH
our agents, and the new agent **shows up in a list of connected agents** in the UI. This is the
interactive, live face of T52's registry.

> **Anna confirmed 14.06:** the external agent answers with **its OWN LLM/logic** — we only
> expose the two-way channel + memory + the Connected list. We do NOT run the stranger's brain;
> our side stays deterministic. (A no-LLM deterministic-reply demo is an acceptable fallback if a
> live external brain isn't ready by 24.06, but the channel must support a real external agent.)

**Step 1 — design doc `docs/connected-agents-design.md`:** specify
- **Identity & registration:** an external agent connects via the T52 SDK (`connect()` with a
  Sui address / signed handshake) → becomes a `source:"connected"` entry in `AgentRegistry`.
  Decide auth (signed payload vs. issued connect-token) and rate limits.
- **Message protocol (two directions):**
  - *external → cabinet:* `POST /api/hive/agents/:id/message` (and/or `submitPrediction`) — the
    external agent posts a thought/prediction; our deterministic engine + T53 chatter let our
    agents **react** to it.
  - *cabinet → external:* the external agent **subscribes** to cabinet messages — choose a
    transport (Socket.io room `hive:agent:<id>` for live, plus a poll fallback
    `GET /api/hive/agents/:id/inbox?since=`). Define the message envelope
    (`{from, to?, kind, text, refPredictionId?, ts}`).
  - SDK helpers: `onCabinetMessage(handler)` / `sendMessage(text)`.
- **Liveness:** `lastSeenAt` heartbeat → connected agents show `online | idle | offline`.
- **Safety:** validate/escape all external text before it ever renders (XSS), cap message rate,
  size limits; external agents can NEVER write numbers into our deterministic engine (same memory
  invariant — they submit their OWN predictions under their OWN agentId only).

**Step 2 — thin implementation slice (after lead GO):**
- **UI "Connected agents" panel** (reuse the modal/overlay shell from T48/T51, opened from the
  menu): lists core + connected agents from `GET /api/public/agents`, with a `connected` badge,
  owner (short Sui addr), online/idle/offline dot, and last message. Tokens-only (designDrift green).
- Register + message endpoints + Socket.io `hive:agent:<id>` room + poll fallback.
- Extend `packages/agent-sdk` with `onCabinetMessage` / `sendMessage`, and an
  `examples/external-agent.ts` that connects, posts a prediction, prints cabinet reactions —
  the **live demo**: "a stranger's agent just joined the cabinet and our agents are arguing with it."
**Acceptance:** running `examples/external-agent.ts` makes a new agent appear in the Connected
panel and exchange ≥1 message with our agents (visible in chatter); a11y + tokens + vitest green;
no Cyrillic, no raw hex.

> **Scoping note for the implementing agent:** these three compound. Build order = T52 (registry
> + SDK foundation) → T53 (deterministic chatter) → T54 (external connect + UI). If time is tight
> before 24.06, the MINIMUM viable ecosystem demo is: registry + `GET /api/public/agents` +
> register endpoint + Connected-agents UI panel + the `examples/` script. Ping lead at each
> design-doc gate.

---

## Lead-Viktor track (I handle these, not the implementing agent)
- L6: after any merge to `main` → re-seed prod + warm (ephemeral-disk rule).
- L7: write any LLM keys into Render (kept off the implementing agent).
- L8: final pre-judging re-seed + warm + smoke test of taken.wal.app.
- L9: review every `*-design` doc (T52/T53/T54) at its gate before the implementation branch.
