<!-- docs/demo-script.md | v1.0.1 | 2026-06-12 -->
# Moneyball — Demo Video Script (≤2:45)

> **Voiceover word count:** ~240 words · ~150 wpm → ~1:36 read time
> Remaining ~1:09 is for pauses, transitions, and screen action beats.

---

## Precondition Summary

| # | Precondition | How to verify | Fallback |
|---|---|---|---|
| P1 | Backend running with `STORAGE_BACKEND=memwal` on mainnet relayer | `curl /health` returns `ok:true` | Wake Render service 60 s before recording; or record against `localhost:3001` |
| P2 | ≥5 matches resolved (with real or admin-injected results) | `GET /api/public/matches` → `recent` has ≥5 entries | Inject via `POST /api/admin/matches` + `POST /api/admin/matches/:id/resolve` ×5 |
| P3 | All 5 agents have predictions on ≥3 resolved matches | `GET /api/public/agents/:agentId/predictions` for each | Pre-seed via `POST /api/admin/agents/:agentId/predict` |
| P4 | ≥1 agent has slept and evolved (param drift visible) | `GET /api/public/agents/:agentId/evolution` returns ≥1 entry | Trigger via `POST /api/admin/agents/:agentId/evolve` |
| P5 | A guest user has disagreed with an agent ≥3× (takeaway milestones at 1 and 3) | `GET /api/me/summary` → `agentDisagreeCounts` ≥3 | Click "Disagree" 3× on camera (beat 4), or `POST /api/admin/simulate/day-plus-one` ×3 |
| P6 | MemWal dashboard shows recent writes with namespace `moneyball` | Open `memory.walrus.xyz` dashboard | Screenshot fallback: capture dashboard before recording |
| P7 | Frontend deployed to Walrus Sites (or `localhost:5173`) | Load URL in browser | Use localhost; show Walrus Sites URL as overlay text |

---

## Shot-by-shot script

### 0:00–0:12 — Hook: the cabinet

**Screen:** Wide shot of the 16-bit-inspired pixel-art arcade cabinet (`CabinetScene`) with 5 agents milling around, thought bubbles floating. `MatchTV` ticker scrolling match results.

**Voiceover:** "Five AI pundits. One FIFA World Cup. No databases — just permanent memory on Walrus. This is Moneyball."

**Fallback (backend asleep):** The cabinet renders client-side with cached state. If agents aren't moving, record a 2 s loop of the static scene — the pixel art still sells the vibe.

---

### 0:12–0:35 — Problem: predictions without memory

**Screen:** Click on Dr. Morgan → `AgentModal` opens, `overview` tab. Show recent predictions — confident picks, some wrong.

**Voiceover:** "Each agent predicts using a different methodology — stats, narrative, contrarian, Bayesian, ensemble. But a model that never learns from being wrong is just a coin flip."

**Fallback:** If predictions list is empty, pre-seed via admin API (P3). Overview tab always loads from store.

---

### 0:35–1:20 — Memory Depth proof: Day 1 vs Day 4+

**Screen:** In `AgentModal`, switch to `predictions` tab → scroll resolved matches showing picks, confidence %, outcomes. Then switch to `evolution` tab → show param-drift entries with timestamps spanning multiple days.

**Voiceover:** "After every batch of resolved matches, agents sleep — and when they wake up, they've evolved. Watch Dr. Morgan's parameters drift over four days. Confidence calibration shifted from aggressive to cautious after two bad calls. That's real learning, persisted permanently on Walrus mainnet."

**Fallback:** If only 1 evolution entry exists, narrate "this is after the first sleep cycle — by day four, there will be multiple drift entries" and keep moving.

`PRECONDITION: P3, P4`

---

### 1:20–1:50 — User memory: you're part of the story

**Screen:** Click "Disagree" button on an agent prediction (`overview` tab). Show the takeaway toast/text that appears. Switch to `memory` tab → show current agent parameters stored on Walrus.

**Voiceover:** "You're not just watching. Disagree with an agent and the system remembers. Your first disagreement, your third — every interaction becomes a permanent takeaway. Even the viewer has memory depth."

**Fallback:** Disagreeing works client-to-server in real time. If backend is cold, wait for Render wake (~30 s) or use localhost.

`PRECONDITION: P5`

---

### 1:50–2:15 — Walrus mainnet proof

**Screen:** Split-screen or tab to MemWal explorer / relayer dashboard. Filter by namespace `moneyball`. Show timestamps matching the evolution entries just demonstrated.

**Voiceover:** "Agent parameters, sleep reports, evolution logs, user summaries — all on Walrus mainnet via MemWal. No Postgres, no S3. Every remember-call has a real blob ID on-chain."

**Fallback:** Use a pre-captured screenshot of the MemWal dashboard with timestamps circled. Overlay text: "Live writes to Walrus mainnet via MemWal relayer."

`PRECONDITION: P6`

---

### 2:15–2:30 — Accessibility & lite mode flash

**Screen:** Toggle the pixel power-switch (`LiteModeToggle`) → `LiteDashboard` renders without Phaser canvas. Quick keyboard navigation through `AgentModal` tabs using arrow keys.

**Voiceover:** "No GPU? Lite mode strips the canvas. Full keyboard nav, screen-reader labels, reduced motion — the whole arcade is accessible."

**Fallback:** None needed — lite mode is purely client-side.

---

### 2:30–2:45 — Close: leaderboard + CTA

**Screen:** Open `StatsBoard` leaderboard showing agent rankings by accuracy. Zoom out to cabinet. Overlay: repo URL + Walrus Sites URL.

**Voiceover:** "Five agents, permanent memory, zero databases. Moneyball — built for the Walrus Memory World Cup."

**Fallback:** If leaderboard is empty, show a single agent's accuracy stat from the modal instead.

`PRECONDITION: P2`
