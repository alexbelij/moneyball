# Knowledge Base

## Architecture Decisions

### Realtime: Socket.io Shared World (2026-06-07)
- **Choice:** Socket.io with Shared World pattern (Variant A)
- **Why:** Less boilerplate, rooms/reconnect out of the box, strong coordination demo
- **Review:** 2026-07-15

### Walrus Writes: Backend-Only (2026-06-07)
- **Choice:** Only the backend writes to Walrus Memory
- **Why:** Key security, schema control, rate-limiting, anti-spam
- **Review:** 2026-07-15

### User Memory Strategy (2026-06-07)
- **Choice:** No full user↔agent chat logs in Walrus; store User Profile & Interaction Summaries by Sui address (no PII)
- **Why:** Privacy + judges see before/after without PII ("Prediction Roast / Fan Twin")
- **Review:** 2026-07-15

### Walrus Storage for Small JSON: Quilt Batching (2026-06-07)
- **Choice:** Quilt-first approach for many small JSON writes
- **Why:** Confirmed by Walrus docs (encoded size ~5× + per-blob metadata overhead; Quilt recommended for many small files)
- **Latest pointers:** Stored off-chain (MVP: off-chain index + snapshot-to-file; Sui dynamic fields v2)
- **Review:** 2026-07-15

### Monorepo with pnpm Workspaces (2026-06-07)
- **Choice:** Single monorepo with pnpm workspaces
- **Why:** Shared event contracts + shared types/schemas, less drift
- **Review:** 2026-07-15

### Scene Composition: Modular (2026-06-07)
- **Choice:** Modular scene composition (not "room as single image")
- **Why:** Interactivity/hover/state on objects, correct layering, extensible rooms
- **Review:** 2026-07-15

### MemWal SDK for Walrus Memory (2026-06-08)
- **Choice:** `@mysten-incubation/memwal` for Walrus Memory integration (Node.js backend)
- **Why:** Official client for Walrus Memory; matches hackathon requirements
- **Entrypoint:** `MemWal.create({ key, accountId, serverUrl, namespace })`
- **Relayer:** `https://relayer.memory.walrus.xyz` (Mainnet)
- **Review:** 2026-07-15

### Memory Storage Strategy (2026-06-09)
- **Choice:** MemWal for all agent/user memories and public events (predictions, evolution); Walrus Storage/Quilt only for files/assets
- **Why:** Matches Walrus Memory judging criteria; cheaper/easier than writing events to storage; avoids frequent on-chain writes
- **Review:** 2026-07-15

### Env Separation (2026-06-08)
- **Choice:** Frontend uses only `VITE_*` (public); backend keeps secrets (`MEMWAL_*`, `ADMIN_TOKEN`)
- **Why:** `VITE_*` vars end up in client bundle; secrets would leak
- **Review:** 2026-07-15

### Networking: Direct Backend URL (2026-06-08)
- **Choice:** Frontend uses absolute `VITE_BACKEND_URL` (no Vite proxy)
- **Why:** Matches production topology; eliminates dev proxy WS errors
- **Backend:** Strict CORS allowlist via `CORS_ORIGINS` env
- **Review:** 2026-07-15

### Sui Wallet Auth (2026-06-09)
- **Choice:** Canonical message auth — backend generates message, frontend signs exact string
- **Why:** Eliminates "message not sane" errors; simplifies verification (strict equality)
- **Auth flow:** `/api/auth/nonce` returns canonical message → frontend signs → backend verifies signature + nonce replay protection → issues JWT
- **Admin:** `role=admin` via `ADMIN_ALLOWLIST` in env (JWT claim)
- **Socket:** `world:join` accepts token and sets socket role/address
- **Review:** 2026-07-15

### Zustand Store (2026-06-09)
- **Choice:** `subscribeWithSelector` to support scene-level subscriptions
- **Why:** Phaser scene must react to store updates even if initial state arrives before subscription
- **Review:** 2026-07-15

---

## Milestones

| Date | Round | Summary |
|------|-------|---------|
| 2026-06-08 | R2 | Realtime Vertical Slice — Socket.io + Phaser + React, 5 agents, thought bubbles, AgentModal |
| 2026-06-08 | R3 | Guest memory + Roast loop (local persistence) |
| 2026-06-08 | R5 | Prod-style networking + Admin demo day+1 + stable agent spawn |
| 2026-06-09 | R6 | Sui wallet auth (dapp-kit) + backend canonical message + JWT |

---

## Technical Debt

- **MemWalUserSummaryStore** writes append-only JSON strings; no explicit upsert keying
  - *Risk:* recall may return multiple versions; picking newest by `updatedAt` (MVP OK)
  - *Trigger:* Transition to structured memories / tagging / stronger retrieval query

---

## Incidents (Resolved)

| Date | Issue | Resolution |
|------|-------|------------|
| 2026-06-08 | MemWal relayer timeout caused backend crash (AbortError) | fire-and-forget writes + try/catch on recall |
| 2026-06-08 | MemWal relayer rate limit 429 (30 weighted-requests/min) | Server-side coalesced write queue (debounce + backoff) |
| 2026-06-08 | Admin token accidentally exposed during development | Token rotated, localStorage key updated |
| 2026-06-08 | Frontend Vite WS proxy errors (EPIPE/ECONNRESET) during backend restarts | Dev-only; ignore and refresh; production unaffected |

---

## MemWal Latency Mitigation
- Server-side TTL cache (30s) for user summaries
- Recall can take 2–4s; cache keeps UX fast without changing API
