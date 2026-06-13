# TASKS-V10 | v1.0.0 | 2026-06-13
# Unified remediation + improvement plan derived from the 5-lens state analysis
# (analysis/STATE-ANALYSIS-2026-06-13.md). Closes every problem found and adds
# loyalty/quality upgrades. Owner decision: FULL version, not MVP.
#
# ── THE ONE TRUTH THAT DRIVES THIS PACK ─────────────────────────────────────────
# Code is ~75-80% done and the memory/evolution core REALLY works. The failure is
# DEMONSTRABILITY: live taken.wal.app serves the OLD build, the live backend serves
# the OLD API (no /api/public/data-source, empty /evolution) and threw 502 on cold
# start. The #1 judging criterion is a *demonstrable* before/after (day1 vs day4+).
# So P0 = make the merged work VISIBLE + SEEDED on prod. Everything else is second.
#
# ── JUDGING CRITERIA (verbatim, from rules) — every task maps to one ─────────────
#   C1 Memory Depth & Authenticity — does memory actually change behaviour? before/after.
#   C2 Creativity & Flair — is it fun, shareable, distinctive?
#   C3 Technical Execution & Completeness — live on Walrus mainnet, Memory integrated, works.
#
# ── LANES ───────────────────────────────────────────────────────────────────────
#   [LEAD] = operational, the lead Viktor executes (deploy/seed/secrets/video/submit).
#            The second Viktor does NOT touch these (needs Anna's wallet / Render / keys).
#   [DEV]  = code tasks for the second Viktor. Branch task/T3x-...; rules below.
#   [BONUS]= Sui Move contract — design-gated, only after P0+P1 are green.
#
# ── HARD RULES for [DEV] (unchanged) ────────────────────────────────────────────
# - TypeScript only; file headers (name|version|date); branch per task (task/T3x-...).
# - vitest for ALL pure logic; UI PRs include screenshots; design-spec.md binding.
# - NO raw hex/emoji/border-radius/gradients in components (T35 designDrift guard fails CI).
#   Import from apps/frontend/src/styles/tokens.ts.
# - Do NOT generate/re-cut image assets. Do NOT move props. Do NOT commit test-results/
#   or playwright-report/ (add to .gitignore if they reappear). Clean junk before PR.
# - Memory invariant (global): the LLM/UI only PHRASES. Every number (pick/confidence/
#   Brier/params/strength) comes from the deterministic engine. Never trust LLM text.
# - Two-step delivery for anything marquee (design branch -> review -> build branch).
#
# ════════════════════════════════════════════════════════════════════════════════
# P0 — MAKE IT DEMONSTRABLE (blocks C1 & C3; do FIRST, this week)  [LEAD]
# ════════════════════════════════════════════════════════════════════════════════
#
## L1 [LEAD] — Redeploy backend from main (24afbab) to Render
# - Trigger a clean deploy of apps/backend at current main so the NEW API is live:
#   /api/public/data-source (T30), /api/public/agents/:id/evolution, /predictions, etc.
# - Verify with curl after deploy: data-source returns 200 JSON; an agent's /evolution
#   is reachable (may be empty until L3 seeds it). Confirm STORAGE_BACKEND=memwal + relayer.
# - Acceptance: every endpoint AgentModal tabs call returns 200 on prod.
#
## L2 [LEAD] — Republish frontend (new build) to taken.wal.app from Anna's address
# - Build apps/frontend at main, publish via publish.sh to Walrus Sites with Anna's wallet
#   (SuiNS taken.sui). Point API base at the live backend; verify CORS/AUTH origin = taken.wal.app.
# - Acceptance: loading taken.wal.app shows the NEW UI — dossier tabs, honest synthetic
#   badge, token-correct pixel surfaces (StatsBoard/HUD/etc.), NOT the old navy build.
#
## L3 [LEAD] — Seed a VISIBLE before/after on prod (THE criterion-1 proof)
# - Using admin-API (adminRoutes/agentEventRoutes/matchRoutes already exist):
#   POST /api/admin/matches + /:id/resolve x>=5 ; /agents/:id/predict ; /agents/:id/sleep
#   + /agents/:id/evolve ; /simulate/day-plus-one to span "day1 -> day4+".
# - Drive it from the reproducible seeder built in T42 (single command, idempotent).
# - Acceptance: /api/public/agents/:id/evolution returns >=2 entries with timestamps
#   spanning multiple days for >=1 agent; AgentModal Evolution tab shows real param drift live.
#
## L4 [LEAD] — Render warm-keep + cold-start safety
# - Confirm cron-job.org pings /health every <14 min (Anna owns it). Document the URL.
# - Pair with T41 (frontend waking-state) so a cold hit never looks like a crash to a judge.
# - Acceptance: two cold-start curls 16 min apart both return 200 within ~60s; no 502.
#
# ════════════════════════════════════════════════════════════════════════════════
# P1 — FLAIR + REQUIRED SUBMISSION ARTIFACTS (C1, C2, C3)
# ════════════════════════════════════════════════════════════════════════════════
#
## T31 / T32 [DEV] — LLM chat + optional dynamic personality
# - ALREADY SPECIFIED in TASKS-V9 + TASKS-V7. Marquee C2 feature. Design branch first
#   (docs/llm-chat-design.md) -> lead review -> build. memory-aware: "connect wallet so I
#   remember you" + roast from MemWal user summary. Keep all V9 invariants.
#
## T36 [DEV] — "Day 1 vs Day N" before/after comparison panel (HIGHEST-VALUE C1 view)
# - New dossier sub-view (in AgentModal Evolution tab or a dedicated tab) that renders a
#   SIDE-BY-SIDE diff: agent params at first snapshot vs latest (confidenceBias, hedgingLevel,
#   topicCalibration), the Brier delta, and a short human sentence ("Day 1: aggressive 88%
#   picks. Day 5: cautious after two bad calls."). Pull from existing evolution/params endpoints.
# - This is the screen the demo video lingers on. Make it unmistakable and judge-legible.
# - vitest the diff/summary builder (pure). Screenshot in PR. Tokens only, no raw hex/emoji.
# - Acceptance: with L3 seed data, panel shows a concrete, true day1->dayN behavioural change.
#
## T37 [DEV] — Memory provenance: "Verify on Walrus" references
# - Backend: when writing memories/evolution events/user summaries to MemWal, capture and
#   expose the Walrus blob/object reference (id/quilt patch id) on the public read models
#   (evolution entries, user summary). Add /api/public/memory/provenance/:agentId if cleaner.
# - Frontend: render a small "stored on Walrus mainnet ↗" affordance per memory/evolution
#   entry linking to the relayer/explorer view. Tokens only; no emoji (use pixel glyph/text).
# - This converts "trust us" into "verify it" — strongest possible C1/C3 signal.
# - Acceptance: a judge can click an evolution entry and reach its Walrus reference.
#
## S1 [LEAD] — Demo video <=3 min — record per docs/demo-script.md
# - Screen recording (NOT generated). Spend most time on T36 before/after + the personal
#   roast moment (connect wallet -> agent recalls prior disagreements). Warm backend first.
#
## S2 [LEAD] — README polish + hero screenshot
# - Lead with the one-liner positioning; "verify on Walrus" + before/after front-and-centre;
#   honest synthetic-data note framed as a feature; quickstart; architecture link.
#
## S3 [LEAD] — Submit through Airtable form (the official submission)
# - URL in rules. Include live URL, repo, video, before/after note. Do NOT miss the deadline.
#
## T44 [DEV or LEAD] — Open GitHub issues for known bugs/feature-requests
# - Rules explicitly reward this (Best Feedback prize: 6 x $50 WAL). File 3-6 genuine,
#   well-written issues (e.g. real-xG, Sui anchor, Quilt batching, cold-start UX).
#
# ════════════════════════════════════════════════════════════════════════════════
# P2 — QUALITY: predictions, memory, code, UX (raises C1 & C3, lowers risk)
# ════════════════════════════════════════════════════════════════════════════════
#
## T38 [DEV] — Make memory change the PICK, not only the tone (closes critic's objection)
# - Today evolution moves confidenceBias/hedgingLevel/topicCalibration — i.e. mostly HOW an
#   agent talks. Judges may say "memory only affects tone." Make calibration able to FLIP
#   borderline picks deterministically (e.g. contrarian's drift widens its draw-band / shifts
#   margin threshold; a strongly negative topicCalibration can move a coin-flip pick). Keep
#   no-RNG and hard bounds. Add an explicit "what memory changed for this agent" explainer.
# - vitest: same match + day1 params vs dayN params yields a DIFFERENT pick in >=1 documented case.
# - Acceptance: demonstrable case where memory alters the actual prediction, not just %.
#
## T39 [DEV] — Real deterministic team-strength from football-data results (upgrade placeholder)
# - Replace teamStrength() hash in predictionEngine.ts with a deterministic strength derived
#   from REAL football-data.org signals (group standings / recent results / goal diff). Still
#   pure + no-RNG. Keep the honesty badge but upgrade the dataSource label from "synthetic"
#   to "derived from real WC2026 results" where true. This makes Brier calibration run against
#   real outcomes meaningfully, strengthening the authenticity story.
# - GATE: only after P0 green. If time-boxed out, leave honest badge — do NOT ship half-real.
# - vitest: deterministic given a fixed results fixture; bounds preserved.
#
## T40 [DEV] — MemWal write durability hardening (queue already exists)
# - memwalWriteQueue.ts already has retry/backoff/retry_after. Harden + make it observable:
#   add a dead-letter path + a tiny /api/public/health/memory (or admin) showing queue depth /
#   last-write status, so durability is provable under Render flakiness. Add structured logs.
# - vitest: enqueue->fail->backoff->retry->success and ->dead-letter paths.
#
## T41 [DEV] — Waking-state UX (cold backend must not look broken)
# - Upgrade OfflineBanner / first-load: when the backend is waking (timeout/502/503), show an
#   in-character "the pundits are waking up…" pixel state with auto-retry, instead of an error.
# - Tokens only; reduced-motion respected. Screenshot in PR.
#
## T42 [DEV] — Reproducible demo seeder + E2E before/after guard
# - scripts/seed-demo.ts: one idempotent command that drives the admin-API to produce the full
#   day1->dayN before/after state (used by L3). Plus a test that asserts the end state
#   (resolved matches, evolved params, non-empty evolution) so the demo can never silently rot.
# - Acceptance: `pnpm seed:demo` against a fresh backend yields a judge-ready before/after.
#
## T43 [DEV] — Shareable roast card (C2 virality / user loyalty)
# - Generate at RUNTIME (canvas/DOM-to-image, NOT pre-made art) a pixel "share card": the
#   agent's roast of the connected user + their record. Copy-link / download. Tokens only.
# - Acceptance: after >=1 disagreement, user can produce a shareable card of their roast.
#
# ════════════════════════════════════════════════════════════════════════════════
# P3 — BONUS: Sui Move smart contract (verifiable memory anchor)  [BONUS]
# ════════════════════════════════════════════════════════════════════════════════
#
## T45 [BONUS] — Move "MemoryRegistry": on-chain commitment anchor for the before/after
# - WHY it's worth it (answering Anna): Walrus stores the memory blobs; a tiny Sui Move
#   contract that stores, per agent, the LATEST MemWal pointer + a rolling hash/version of
#   evolution events (emitting a Sui event per update) makes the day1->dayN history
#   *independently verifiable and tamper-evident* — nobody can claim we backfilled the
#   before/after. That hits C1 (authenticity) AND C3 (technical), and reuses the Sui wallet
#   already integrated. It is a genuine guarantee, not a gimmick.
# - SCOPE (keep tiny): MemoryRegistry object with a Table<agentId, {latestPointer, evoHash,
#   version, updatedAt}>; entry fn update_anchor(agentId, pointer, evoHash); event AnchorUpdated.
#   Backend signs+submits after each evolution (lead wires the key). Frontend: "verify on Sui ↗"
#   link next to T37's Walrus provenance.
# - DELIVERY GATE: design doc first — branch task/T45-sui-anchor-design,
#   docs/sui-memory-anchor-design.md (object model, write path, gas/key handling, failure =
#   non-blocking fire-and-forget like Walrus writes, testnet vs mainnet). STOP, lead reviews.
#   Build ONLY after P0+P1 are green; this must never block the core submission.
# - NOT chosen (rejected as lower ROI / more risk): commit-reveal prediction contract,
#   soulbound agent NFTs. Note them as future work / GitHub issues, don't build now.
#
# ── SUGGESTED ORDER ─────────────────────────────────────────────────────────────
#   1) [LEAD] L1->L2->L3->L4  (this is the whole ballgame; do today/tomorrow)
#   2) [DEV] T42 (seeder, unblocks L3) ‖ T36 (before/after panel) ‖ T31 design
#   3) [DEV] T37 provenance, T41 waking-state  → [LEAD] S1 video, S2 README
#   4) [DEV] T38, T40, T43  → [LEAD] S3 submit + T44 issues
#   5) [DEV] T39 (if time), [BONUS] T45 design -> build (only if 1-4 green)
