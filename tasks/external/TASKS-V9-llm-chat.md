# TASKS-V9 | v1.0.0 | 2026-06-13
# Pack for the second Viktor — GO-AHEAD on the LLM features (T31 + T32).
# This is NOT a new spec: T31/T32 are fully specified in TASKS-V7-functionality.md.
# This file = updated world-state + the delivery gate + concrete code anchors.
#
# ── STATE OF THE WORLD (verified, main = 24afbab) ───────────────────────────────
# MERGED & green (typecheck clean, 204/204 vitest in 25 files, no junk):
#   T26 methodology in dossier · T27 per-agent Brier chart · T28 evolution story
#   T29 personality roast + thought bubbles · T30 honest synthetic-data badge
#   T33 single token module (src/styles/tokens.ts) · T34 legacy reskin
#   T35 consistency pass + browser-free design-drift guard.
# => The whole V6/V7-functional/V8-pixel program is DONE except the LLM layer.
# Your next work = T31 (then T32). Owner decided: FULL version, LLM chat = Option B.
#
# ── HARD RULES (unchanged) ──────────────────────────────────────────────────────
# - TypeScript only; file headers (name|version|date); branch per task (task/T3x-...).
# - vitest for all pure logic; UI PRs include screenshots; design-spec.md binding for UI.
# - Do NOT generate/re-cut images. Do NOT move props.
# - You build everything behind an LLMClient interface + a deterministic fallback so
#   CI/tests NEVER need a key. Do NOT put any API key in the repo, env files, or tests.
#   The lead Viktor wires real keys to Render env separately. You only read process.env.
#
# ── DELIVERY GATE (important) ───────────────────────────────────────────────────
# T31 is the marquee demo feature. Deliver in TWO steps so we don't churn:
#   STEP 1 — branch `task/T31-chat-design`: a 1-page design doc
#            `docs/llm-chat-design.md` covering: LLMClient interface + provider-chain
#            (groq -> gemini -> deterministic, env-driven, NOT hardcoded), the
#            deterministic context-assembler shape, the persona-lock + topic-filter
#            approach, the auth/memory gating, cost guards, and the chat UI placement.
#            STOP and push. Lead reviews before you implement.
#   STEP 2 — after the design is accepted: branch `task/T31-chat` for the build.
# Push the design branch + ping the owner with branch name + SHA; lead reviews, then green-lights step 2.
#
# ── CODE ANCHORS (already in main — plug in, don't reinvent) ─────────────────────
# - Persona/methodology/catchphrases/roastLines: apps/backend/src/agents/agent-config.v1.json
# - Profile service (T26): apps/backend/src/agents/agentProfileService.ts
# - Persona service (T29): apps/backend/src/agents/agentPersonaService.ts
# - Routes + identity gating: apps/backend/src/http/apiRoutes.ts
#     getUserId(req) -> { userId, kind: 'sui' | 'guest' } | null  (USE THIS for memory gating)
# - Current AgentParams / predictions / evolution / MemWal user summary: already exposed
#   via existing endpoints used by AgentModal tabs — assemble context from these.
# - Design tokens for the chat UI: apps/frontend/src/styles/tokens.ts (NO raw hex — the
#   T35 designDrift guard WILL fail CI on hardcoded hex/emoji/border-radius/gradients).
#
# ── INVARIANTS (must hold for every provider) ───────────────────────────────────
# 1. The LLM only PHRASES. Every number (pick/confidence/Brier/params) comes from the
#    deterministic engine and is injected into context — never trusted from LLM text,
#    never mutated by the LLM.
# 2. PERSONA LOCK: football-only, obsessed. Off-topic (politics/code/personal) is
#    deflected in-character ("I only think in xG"). Enforce in system prompt + a cheap
#    topic filter. vitest the topic filter + the context assembler (both pure).
# 3. MEMORY GATING: sui:<wallet> -> durable per-user MemWal read+write; guest:<id>/null
#    -> session-only, NO durable write/recall. Demo line: "connect wallet so I remember you".
# 4. COST GUARD: per-user/session rate limit + max tokens + daily cap; on 429/5xx/timeout
#    fall through the provider chain; if all fail -> deterministic in-persona canned reply.
#
# ── PROVIDER NOTES (from live testing 13.06; keys held by lead, NOT in this repo) ─
#   LLM_PRIMARY=groq  GROQ_MODEL=llama-3.3-70b-versatile  (OpenAI-compatible, ~0.5s)
#   LLM_FALLBACK=gemini  GEMINI_MODEL=gemini-flash-latest  (THINKING model — MUST set
#     generationConfig.thinkingConfig.thinkingBudget=0; 2.0-flash returns 429 on this key)
#   Final fallback = deterministic. All selection driven by env, never hardcoded.
#
# ## T32 — LLM-dynamic personality (OPTIONAL, only after T31 is merged)
#   Reuse the same LLMClient to optionally phrase roasts / thought-bubbles / match
#   commentary, with the T28/T29 deterministic templates as fallback. Same persona lock,
#   same cost guard, same "numbers from engine only" invariant. See TASKS-V7 T32.
