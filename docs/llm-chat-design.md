<!-- llm-chat-design.md | v1.0.0 | 2026-06-13 -->

# T31 — Agent Chat (LLM-backed) — Design Doc

**Status:** design-first gate (TASKS-V9). This is STEP 1 — review before any code lands.
The marquee Memory-Depth demo: a user talks to an agent and *feels its evolution* —
"last time you were 70% on Brazil, now you hedge to 60% — why?" — because the agent's
**current** evolved params and **this user's** disagree-history are injected into context.

## 0. Non-negotiable invariants (hold for EVERY provider, incl. fallback)
1. **LLM only phrases.** Every number (pick / confidence / Brier / params) comes from the
   deterministic engine and is injected as context. We never parse numbers out of LLM
   text, never let the LLM mutate params or predictions.
2. **Persona lock — football only.** Off-topic (politics/code/personal) is deflected
   in-character ("I only think in xG"). Enforced in system prompt **and** a cheap pre-filter.
3. **Memory gating.** `sui:<addr>` → durable per-user MemWal read+write; `guest:<id>` /
   no identity → session-only, **no durable write/recall**. Demo nudge: "connect wallet so
   I remember you."
4. **Cost guard.** Per-identity rate-limit + max output tokens + daily cap; on
   429/5xx/timeout fall through the provider chain; if all fail → deterministic in-persona
   canned reply (HTTP 200, `source:'deterministic'`). **No API key ever in repo/env-files/tests.**

## 1. LLMClient interface (provider-agnostic seam)
New package area: `apps/backend/src/llm/`.

```ts
// llm/types.ts
export interface ChatTurn { role: 'system' | 'user' | 'assistant'; content: string }
export interface LlmRequest {
  system: string            // assembled persona + deterministic context
  messages: ChatTurn[]      // prior user/assistant turns (session-trimmed)
  maxTokens: number
  temperature?: number
}
export interface LlmResult {
  text: string
  provider: 'groq' | 'gemini' | 'deterministic'
  usage?: { inputTokens?: number; outputTokens?: number }
}
export interface LlmClient { complete(req: LlmRequest): Promise<LlmResult> }
```

- **`GroqClient`** — OpenAI-compatible REST; `GROQ_MODEL=llama-3.3-70b-versatile` (~0.5s).
- **`GeminiClient`** — fallback; `GEMINI_MODEL=gemini-flash-latest`. **MUST** set
  `generationConfig.thinkingConfig.thinkingBudget=0` (it is a thinking model;
  `2.0-flash` 429s on the lead's key — do not hardcode a model).
- **`DeterministicClient`** — never fails; returns an in-persona canned line built from
  `agent-config` catchphrases + the injected context. Used as final fallback **and** as the
  default when no keys are present (so CI/tests never need a key).
- **`ChainedLlmClient`** — wraps `[primary, fallback, deterministic]`, ordered by env, and
  walks the chain on error/timeout/budget. **Selection is env-driven, never hardcoded.**

### Env (read in `config/env.ts`; real values wired to Render by lead — NOT in repo)
```
LLM_PRIMARY=groq            LLM_FALLBACK=gemini
GROQ_API_KEY=…  GROQ_MODEL=llama-3.3-70b-versatile
GEMINI_API_KEY=… GEMINI_MODEL=gemini-flash-latest
LLM_MAX_OUTPUT_TOKENS=320   LLM_TIMEOUT_MS=8000
LLM_USER_MIN_INTERVAL_MS=4000   LLM_DAILY_CAP_PER_USER=40
```
A provider is only added to the chain if its key is present; otherwise the chain is just
`[deterministic]`. Factory: `buildLlmClient(env): LlmClient`.

## 2. Deterministic context assembler (pure, unit-tested)
`llm/contextAssembler.ts` — **pure function**, no LLM, no I/O; takes already-fetched data
and returns the system prompt. This is the trust boundary: only these numbers reach the model.

```ts
buildAgentChatContext(input: {
  profile: PublicAgentProfile          // personality/methodology/catchphrases (agent-config)
  params: AgentParams                  // CURRENT evolved params (sleepService.getParams)
  predictions: AgentPredictionEvent[]  // recent picks: pick/confidence/reasoning (+outcome)
  evolution: AgentEvolutionEvent[]     // recent param-change story (T28)
  userMemory: UserSummary | null       // null for guest → "no durable memory" framing
  identityKind: 'sui' | 'guest'
}): string   // system prompt
```

Data sources are **existing endpoints/services** (plug in, do not reinvent):
- `AgentProfileService.get(id)` / `GET /api/public/agents/:id/profile`
- `sleepService.getParams(id)` / `GET /api/public/agents/:id/params` (current evolution)
- `GET /api/public/agents/:id/predictions` and `/evolution`
- `getUserSummaryStore().getOrCreate(userId)` → `agentDisagreeCounts`, `takeaways`

The prompt encodes: who the agent is, its current params (so answers reflect drift), its
recent picks with the **engine's** confidences, and (sui only) the user's disagree history.
A hard rule line forbids inventing numbers and restates the football-only lock.

## 3. Persona lock + topic filter
- **System-prompt guardrail:** "You are {name}, a football forecaster obsessed with the
  game. You ONLY discuss football/this tournament/your methodology. Any other topic →
  refuse in-character. Never state a number not given in context."
- **`llm/topicFilter.ts` (pure, unit-tested):** cheap allow/deflect classifier on the user
  turn (keyword + heuristic). On clear off-topic → short-circuit with a deterministic
  in-character deflection (no LLM call — also saves budget). Borderline → let the LLM
  enforce via prompt. Tests cover football terms (pass), politics/code/personal (deflect).

## 4. Auth / memory gating
- Identity from the **existing** `getUserId(req)` → `{ userId, kind } | null`
  (`x-guest-id` header + optional `Bearer` JWT for sui; same as `/api/me/*`).
- `kind:'sui'` → read MemWal summary into context **and** record interaction signals
  (reuse `recordDisagree`-style writes via the store; no new durable schema for T31).
- `kind:'guest'` or `null` → assemble context **without** durable memory; replies include a
  one-time nudge to connect a wallet. Session history kept in-memory only, never persisted.

## 5. Cost guard
- Reuse `util/rateLimit.ts` `SimpleRateLimiter(LLM_USER_MIN_INTERVAL_MS)` keyed by `userId`.
- Add a per-user **daily counter** (in-memory map keyed by `userId + dayKey()`,
  cap `LLM_DAILY_CAP_PER_USER`); over cap → deterministic reply with `meta.capped:true`.
- `maxTokens = LLM_MAX_OUTPUT_TOKENS`; per-call `LLM_TIMEOUT_MS` abort → next provider.
- All-providers-failed → `DeterministicClient` reply, HTTP 200, `source:'deterministic'`.

## 6. API contract
```
POST /api/agents/:id/chat        (identity-gated via getUserId; 401 MISSING_IDENTITY if null)
  body: { message: string, history?: ChatTurn[] }   // history is session-only, client-held
  200:  { ok: true, text, meta: { provider, identity: 'sui'|'guest',
                                  source: 'llm'|'deterministic', capped?, deflected? } }
  400:  MISSING_MESSAGE   429: RATE_LIMITED (interval)   // daily cap returns 200 deterministic
```
Registered in `apiRoutes.ts` next to `/api/roast`. Numbers in the reply are only those the
assembler injected.

## 7. Chat UI placement
- New **`chat`** tab in `AgentModal` (extend `Tab`/`TABS` in `AgentModal.tsx`; the
  WAI-ARIA tablist + roving-tabs + focus-trap already exist). Keeps the "talk to this
  agent" mental model and reuses the dialog a11y.
- Pixel styling strictly from `apps/frontend/src/styles/tokens.ts` — **no raw hex / emoji /
  border-radius / gradients** (the T35 `designDrift` guard fails CI otherwise). Reuse
  `PixelButton`, message rows as token-bordered blocks, a `LoadingSkeleton`/typing row.
- Frontend `lib/api.ts` gains `chat(agentId, message, history)` (identity headers already
  injected by `apiFetch`). Guest sees the connect-wallet nudge inline.
- Reduced-motion respected; screenshots included in the STEP-2 build PR.

## 8. File layout (STEP 2 — build)
```
apps/backend/src/llm/{types,groqClient,geminiClient,deterministicClient,chainedClient,
                      contextAssembler,topicFilter,index}.ts
apps/backend/src/llm/{contextAssembler,topicFilter,chainedClient}.test.ts   // pure, key-free
apps/backend/src/http/apiRoutes.ts            // + POST /api/agents/:id/chat
apps/backend/src/config/env.ts                // + LLM_* (key-optional)
apps/frontend/src/components/AgentModal.tsx   // + 'chat' tab
apps/frontend/src/components/AgentChat.tsx    // new, token-pure
apps/frontend/src/lib/api.ts                  // + chat()
docs/api.md                                   // document the new endpoint
```

## 9. Test plan (CI never needs a key)
- **contextAssembler**: numbers in prompt match injected data; guest omits durable memory.
- **topicFilter**: football → allow; politics/code/personal → deflect.
- **chainedClient**: primary throws → fallback used; all throw → deterministic, never rejects.
- **route**: 401 without identity; 429 on rapid repeat; deterministic when no keys configured.
- Frontend: chat tab renders, token colours via getComputedStyle, no emoji/hex (designDrift).

## 10. Open questions for review
1. Chat tab in `AgentModal` vs a docked panel — design-spec leans modal tab; confirm.
2. Durable write scope for sui on T31: only existing disagree/summary signals, or a new
   lightweight `chatTurns` count in `UserSummary`? (Prefer **no new schema** for T31.)
3. Daily-cap store: in-memory map is fine for the demo; promote to MemWal later? 
4. Should off-topic deflections also count against the daily cap? (Proposed: no.)
