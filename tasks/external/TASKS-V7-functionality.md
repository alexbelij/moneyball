# TASKS-V7 | v1.0.0 | 2026-06-13
# Pack for the second Viktor — FUNCTIONAL gaps (not art/layout; art comes from the
# owner's regenerated assets + the T22 constructor export).
# Context: dossier modal EXISTS in merged code (c196521) but the live site is a stale
# build, and several capabilities below are missing or only stubbed.
#
# HARD RULES:
# - TypeScript only; file headers (name|version|date); vitest for pure logic; branch
#   per task (task/T2x-...); screenshots in UI PRs (design-spec.md binding for UI).
# - Do NOT generate/re-cut any image. Do NOT move props (owner owns placement via T22).
# - Base branches on main. Keep zero-LLM determinism UNLESS a task explicitly says LLM
#   (T31/T32 are gated on the owner's decision — do NOT start them without her go).
#
# ── STATE OF THE WORLD (verified) ───────────────────────────────────────────────
# WORKS today (merged, may need republish to be visible live):
#   - 5 deterministic agents w/ methodologies (predictionEngine, zero RNG/LLM).
#   - Real WC fixtures+scores via football-data.org (footballDataProvider).
#   - Self-learning loop: sleep-worker Reflection->Evolution calibrates AgentParams
#     (confidenceBias / hedgingLevel / topicCalibration), bounded |Δ|<=0.1 per sleep,
#     rollback on Brier regression, audit-logged, mirrored to MemWal on Walrus mainnet.
#   - Memory: MemWal append-only (agent evolution history + per-user disagree summary).
#   - Socket.io live + REST hydration; Sui auth; Roast; Disagree; StatsBoard; Lite mode.
#   - AgentModal dossier in code: Overview / Predictions / Evolution / Memory tabs.
# So: "memory & development" DO work. What's missing is (a) LLM-style reasoning/chat,
# (b) surfacing personality+methodology, (c) per-agent charts, (d) real data inputs.

## T26 — Surface methodology in the dossier (no LLM)
- Expose each agent's methodology (type, formula, parameters, evolution_trigger) from
  agent-config.v1.json via a new public read endpoint `/api/public/agents/:id/profile`
  (also: name, role, personality, catchphrases). No secrets.
- AgentModal: new "Methodology" section in Overview (or a 5th tab) rendering the formula,
  plain-language description, and the evolution trigger. Pixel/SNES style per design-spec.
- vitest: profile endpoint shape; UI snapshot of the section.

## T27 — Per-agent performance chart in the dossier
- In AgentModal Predictions/new "Performance" tab: render the agent's rolling Brier +
  accuracy over time (reuse brierSeries.ts from T15) as an inline SVG chart, plus
  hit/miss tally and current effective-confidence calibration.
- Data already available via /predictions + /evolution + /params. No backend change unless
  a derived series endpoint is cleaner (your call; document it).
- vitest for the series transform; screenshot in PR.

## T28 — Human-readable evolution story
- EvolutionTab currently lists raw param diffs. Add a generated (template, deterministic)
  one-line narrative per evolution event, e.g. "After 3 wrong away-win calls, Dr. Morgan
  trust in defensive-injury weight +12% (v4→v5)". Derive strictly from the event's deltas
  + trigger metadata — NO invented numbers, NO LLM.
- vitest: narrative is a pure function of the event; covers every delta kind.

## T29 — Wire agent personality into roast + room thought bubbles
- Roast endpoint (/api/roast): pick from the agent's own roastLines (agent-config) keyed
  by disagree count / recent accuracy, instead of the 3 generic strings. Still memory-
  driven (uses MemWal user summary). Deterministic selection (hash of userId+agentId+day).
- Room: cycle thoughtBubbles by agent live state (analyzing/watching/coffee) from config;
  restyle the bubble per design-spec (currently a plain white rect). reduced-motion safe.
- vitest for selection determinism.

## T30 — Honest "data source" surfacing (no paid feed yet)
- predictionEngine.teamStrength is a stable hash placeholder, not real xG/odds. Make this
  HONEST in the UI: a small "model inputs: synthetic (v1)" badge in the dossier, and a
  documented seam (already in code comments) for a real xG/odds adapter.
- Do NOT fake real stats. This is a transparency task, not a data-integration task.
- (Real xG/odds integration = separate future task, needs owner budget decision.)

# ── DECIDED (13.06): full version, LLM chat = Option B. Football-only, memory-aware. ──
# LLM provider = GEMINI (tested working 13.06). Env vars (set in Render, NEVER in repo):
#   LLM_PROVIDER=gemini  GEMINI_API_KEY=<secret, owner-provided>  GEMINI_MODEL=gemini-flash-latest
# IMPORTANT model notes from live testing:
#   - This key's project has free-tier quota ONLY on the *-latest aliases / 2.5 models;
#     `gemini-2.0-flash` returns 429 (free_tier limit 0). USE `gemini-flash-latest`.
#   - gemini-flash-latest is a THINKING model — it burns output budget on internal
#     reasoning, truncating answers & adding latency. MUST set
#     generationConfig.thinkingConfig.thinkingBudget=0 for chat. With that: ~1.4–1.8s warm,
#     occasional ~6s cold start; persona quality excellent, off-topic deflection works.
#   - REST: POST generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=KEY
#     body: {system_instruction:{parts:[{text:PERSONA+CONTEXT}]}, contents:[{parts:[{text:USER}]}],
#            generationConfig:{maxOutputTokens, thinkingConfig:{thinkingBudget:0}}}
# Build everything behind an LLMClient interface + deterministic fallback so tests/CI never
# need the key. Key is wired to Render env separately (by the lead Viktor), not by you.

## T31 — Agent chat (LLM-backed, football-only, memory-aware) — deliver 1-pg design first
- Backend: POST `/api/agents/:id/chat` (or socket room). Per-user, auth-gated.
- Context assembled DETERMINISTICALLY and injected as system prompt: agent profile
  (personality/methodology/catchphrases from agent-config), CURRENT AgentParams (so the
  chat reflects the agent's evolution), its recent predictions, and THIS user's MemWal
  memory (disagree history). => the user can literally feel the memory change through
  conversation ("last time you said 70%, now you hedge to 60% — why?"). This is the
  Memory-Depth selling point, not a generic chatbot.
- INVARIANT (decision rule "LLM never mutates numbers"): the LLM only PHRASES; every
  number (pick/confidence/Brier) comes from the deterministic engine. LLM must never
  invent predictions or alter params.
- PERSONA LOCK: the agent talks ONLY about football, as if obsessed with it. Hard
  guardrail — any off-topic question (politics, code, personal) is deflected in-character
  ("I only think in xG"). Enforce in system prompt + a cheap topic filter.
- Cost guard: per-user/session rate limit, max tokens, daily cap; deterministic fallback
  message if the provider is down/over budget. Pixel chat UI per design-spec (new tab in
  AgentModal or docked panel). vitest: context assembler is pure; persona-filter unit tests.

## T32 — LLM-dynamic personality (optional, same guardrails)
- Reuse the LLMClient: optionally generate roasts / room thought-bubbles / match
  commentary in-character, with the T28/T29 deterministic templates as fallback. Same
  football-only persona lock + cost guard. Numbers still come from the engine, never LLM.
