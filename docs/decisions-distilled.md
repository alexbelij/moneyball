<!--
 decisions-distilled | v1.0.0 | 2026-06-12
 Purpose: Single context entry point distilled from the full design chat (22k lines),
 MASTER_CONTEXT v0.3 and hackathon rules. Any AI/contributor should read this first.
-->
# Moneyball Cabinet — Distilled Decisions & State
> Source: chat_log.md (22k lines, 126 msgs, Rounds 1–7), gpt_log.md (MASTER_CONTEXT v0.3), repo @ 23c3b79, hackathon rules.
> Date: 2026-06-12. Hackathon: Walrus Memory World Cup, Jun 5–24, results Jul 2. Prizes $2k WAL.

## 1. Judging criteria (what wins)
1. **Memory Depth & Authenticity** — memory must visibly change agent behaviour; genuine before/after (day 1 vs day 4+). ← top criterion.
2. **Creativity & Flair** — WC2026 as live backdrop, fun/unexpected use.
3. **Technical Execution** — live on **Walrus Mainnet** with Walrus Memory correctly integrated; focused working MVP > ambitious broken.
Submission: Airtable form, demo video < 3 min, GitHub tickets for bugs = "Best Feedback" prize track.

## 2. Product concept (approved World Design v1)
Pixel-art (cinematic 16-bit-inspired, side view) scouts' cabinet. 5 AI agents with distinct methodologies predict FIFA WC 2026 matches, evolve from outcomes, roast users. Shared world: all users see the same scene (Socket.io). Click agent → modal (predictions / evolution / memory). Thought bubbles over agents like NPC games. Interactive objects over background: TV (match in progress + popup), coffee machine, magnetic boards (agent chat), door, light switch, phone, radio/cassette player, folders. Stretch: more rooms (corridor, kitchen, archive, toilet), user-created agents appearing at the door, betting (v2, no own funds), Seal encryption (v2).

## 3. Fixed architecture decisions (Decision Log, do not re-litigate)
- Monorepo pnpm: apps/frontend (React+Phaser+Zustand+mitt EventBus), apps/backend (Node+Express+Socket.io), packages/shared (typed socket contract).
- Realtime = Socket.io shared world (Variant A). Contract in packages/shared/src/events.
- **Walrus writes backend-only** (keys never in browser). MemWal `@mysten-incubation/memwal`, relayer `https://relayer.memory.walrus.xyz` (mainnet), `MemWal.create({key, accountId, serverUrl, namespace})`.
- **MemWal = memory for all agent/user memories + public events (predictions, evolution). Walrus Storage/Quilt only for files/assets.** Latest pointers off-chain.
- No full chat logs stored. Per-wallet **User Profile & Interaction Summaries** (no PII, plaintext MVP) → Roast / Fan Twin. recall on connect → agent teases user.
- Sui auth: backend-generated canonical nonce message → wallet signs exact string → verify → JWT (HS256 only) with role; admin = ADMIN_ALLOWLIST of Sui addresses. Connect ≠ Sign-In (JWT needed for admin/creator actions). Guest mode (localStorage guestId) kept for non-wallet visitors.
- MemWal hardening (done): fire-and-forget writes, try/catch recall, 30s TTL summary cache, coalescing write queue + 429 backoff w/ retry_after_seconds, bounded queue.
- Evolution is **deterministic/algorithmic** (params, thresholds); LLM never mutates numbers — only optional phrasing. Tarot/numerology agents: deterministic core tables, LLM just voices it. MVP: template texts, no LLM at all.
- Prod-style networking: VITE_BACKEND_URL absolute, no Vite proxy; strict CORS allowlist; frontend env only VITE_*; secrets backend-only.
- Phaser: modular scene composition (objects as separate interactive sprites over background, NOT one baked image); subscribeWithSelector in Zustand (world:state race fix); freeze/blur world during wallet flow (driven by real connection state, not click guessing).
- Style: headers in files (name | version | date), all code/comments/docs in **English** (some RU docs remain → translate). Owner does everything by hand on a 2015 MBP 8GB → performance matters (fewer re-renders, lightweight).

## 4. Owner's working rules (Anna)
- "MVP = cut features, NOT sloppy implementation. Build like production from the start."
- Spec-driven, vertical slices, decision log (docs/knowledge_base.md), ADRs (adr/), DoR/DoD.
- Wants ready copy/paste APPLY blocks (cat > file <<'TS') + doc blocks for knowledge_base.
- Never paste secrets in chats (ADMIN_TOKEN leaked once → rotated).

## 5. Current repo state (verified @ 23c3b79)
DONE: world vertical slice (5 agents, thoughts, modal), guest+Sui auth+JWT+allowlist, MemWal user summaries live (meta.storage=memwal), roast/disagree loop, write queue, public GET predictions/evolution + admin POST predict/evolve/day+1, agent-config.v1.json (5 personas: dr_morgan Statistician + 4 more, catchphrases, roastLines), ADRs 1–4, worldStateStore + test.
NOT DONE (chat cut mid-Round 7):
- AgentModal tabs Predictions/Evolution/Memory (code was being delivered when chat ended — repo has old 139-line modal, no tabs).
- **Match data pipeline — nothing exists** (no fixtures, no results, no auto-predict/resolve). Candidates discussed: football-data.org / API-Football / TheSportsDB / openfootball. No final decision. Budget ≤ $5–10 total.
- **sleep-worker not integrated** (sits in /sleep-worker, standalone sim only; 4 REPRO bugs from architecture_review.md unfixed; real MemWalClient/AgentEventReader adapters missing).
- Pixel-art assets (only statistician.meta.json placeholder; no background, no TV/coffee/boards sprites).
- Agent behaviours (walk/sit/coffee/watch-TV during matches), interactive objects.
- Leaderboard/StatsBoard, XP/reputation (accepted in World Design).
- Deployment: nothing live. Need backend host + frontend on Walrus Sites mainnet.
- README/quickstart, demo video, submission.

## 6. Open questions (need Anna's call)
1. Match data source (recommend: football-data.org free tier covers WC; fallback TheSportsDB; openfootball for static fixtures).
2. Backend hosting (Render free / Railway / Fly ≈ $0–5) — who creates the account; frontend → Walrus Sites.
3. Assets: generate via image-gen in approved style (she has reference style from gpt/chat) — need her reference image(s).
4. LLM in MVP: keep zero-LLM templates (recommended, $0, deterministic) or add one cheap provider for phrasing.
