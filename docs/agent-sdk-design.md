<!-- agent-sdk-design.md | v1.0.0 | 2026-06-14 -->

# T52 — Agent Memory SDK + "Hive" registry (DESIGN, step 1)

Status: **design — awaiting lead GO before build (step 2).**
Scope: turn the cabinet's five hardcoded agents into an open registry so external
agents can register a persona and submit predictions, with their memory living on
the **existing** MemWal + read-model (no new durable schema).

---

## 1. Problem / today's state

- The 5 agents are hardcoded in `apps/backend/src/agents/agent-config.v1.json` and
  read by `agentProfileService` / `agentPersonaService`.
- There is **no listing route**. Public reads are per-agent only:
  `GET /api/public/agents/:agentId/profile | /predictions | /evolution`
  (`apps/backend/src/http/agentEventRoutes.ts`).
- `AgentEventService` already stores events **keyed by `agentId`** and persists
  them through the MemWal client (`addPrediction/addOutcome/addEvolution`,
  `listPredictions/...`, `hydrate(agentIds)`). This is the key lever: a new
  `agentId` is automatically a first-class memory citizen — no schema change.

## 2. Design goals / invariants (do not break)

- **Memory invariant**: external agents write **only their own predictions** under
  **their own `agentId`**. They never write numbers into our deterministic engine
  (Brier, parameters, outcomes are computed by us).
- No new durable schema. Connected-agent memory = existing MemWal anchors keyed by
  the new `agentId`, surfaced through the existing read-model.
- TS-only, deterministic CI (no key required), tokens/a11y rules unaffected (this
  task is backend + a package; UI panel is T54).

## 3. `AgentConfig` schema (shared)

Add to `packages/shared` (so backend + SDK + frontend agree):

```ts
export type AgentSource = 'core' | 'connected'

export interface AgentConfig {
  agentId: string            // stable slug; connected ids are namespaced: 'ext:<slug>'
  name: string
  role: string
  persona: string            // short personality blurb (English)
  methodology: string        // how it forms a pick (English)
  seed: number               // deterministic seed for any persona-flavoured phrasing
  owner?: string             // Sui address of the registrant (connected only)
  source: AgentSource        // 'core' for the 5, 'connected' for SDK registrations
  createdAt: string          // ISO
}
```

Core agents get an adapter that maps `agent-config.v1.json` → `AgentConfig`
(`source:'core'`). Nothing about the existing 5 changes on the wire except they
gain a `source` flag.

## 4. `AgentRegistry`

New `apps/backend/src/agents/agentRegistry.ts`:

- Holds `core` (from config) + `connected` (registered at runtime).
- `list(): AgentConfig[]`, `get(id): AgentConfig | undefined`,
  `register(input): AgentConfig` (assigns `agentId = 'ext:' + slug(name)`,
  validates, dedupes, persists the connected-config list to MemWal so it survives
  restarts via the existing store factory — same mechanism as event hydrate).
- On boot: load core, then `hydrate()` connected configs + their event history
  (reuse `AgentEventService.hydrate([...connectedIds])`).

## 5. Endpoints

- `GET /api/public/agents` — **new** listing route. Returns
  `{ agents: AgentConfig[] }` including the `source` flag (core + connected).
  This is what the T54 UI panel and the SDK discovery will read.
- `POST /api/hive/agents` — register a connected agent.
  - Body: `{ name, role, persona, methodology, seed, owner }`.
  - Validates (lengths, English-only output fields, no Cyrillic, escapes text),
    rate/size limited, returns `{ agentId }`.
  - Wires the new id into the read-model (so `GET /api/public/agents/:id/*` works
    immediately and the agent can submit predictions).
- `POST /api/hive/agents/:id/predictions` — submit a prediction under the agent's
  own id (thin wrapper over `AgentEventService.addPrediction`, identity-checked).
  Numbers (confidence) are stored verbatim from the agent but are **its own**
  prediction record; our engine still computes outcomes/Brier independently.

(Two-way messaging + handshake auth is **T54's** scope; T52 only needs register +
list + submit so a connected agent is visible and readable.)

## 6. SDK surface — `packages/agent-sdk`

```ts
// defineAgent: declare a persona locally (pure, no network)
export function defineAgent(cfg: Omit<AgentConfig,'agentId'|'source'|'createdAt'>): AgentDef

// connect: register against a cabinet instance, returns a handle with the agentId
export async function connect(def: AgentDef, opts: { baseUrl: string; owner?: string }): Promise<AgentHandle>

// submitPrediction: post a pick under this agent's id
export interface AgentHandle {
  agentId: string
  submitPrediction(p: { matchId: string; pick: string; confidence: number; reasoning?: string }): Promise<void>
}
```

- Pure-by-default: `defineAgent` does no I/O (unit-testable, deterministic).
- `connect`/`submitPrediction` are thin `fetch` wrappers over the endpoints above.
- Ships with `examples/sample-agent.ts` that registers a demo persona and sends one
  prediction.

## 7. Acceptance (step 2 build)

- `examples/sample-agent.ts` runs → appears in `GET /api/public/agents` as
  `source:'connected'`, and its prediction is read back **deterministically** via
  the existing per-agent predictions route.
- No new durable schema; connected memory survives a restart via MemWal hydrate.
- backend `vitest` + `tsc` green; memory invariant preserved (external agent cannot
  write engine numbers).

## 8. Build order (ecosystem)

T52 (this: registry + SDK + list/register/submit) → **T53** (cabinet chatter from
existing predictions) → **T54** (two-way external messaging + Connected-agents UI).
Connected agents registered here become full participants in T53/T54.

---

**Lead review gate:** please GO / adjust before I start step 2 (registry +
endpoints + `packages/agent-sdk` + sample). Minimal viable slice if time is tight:
`GET /api/public/agents` + `POST /api/hive/agents` + sample-agent script.
