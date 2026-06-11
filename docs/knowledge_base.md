# Knowledge Base

## Decisions
- **2026-06-07:** Shared World (Variant A) + Socket.io
- **2026-06-07:** Walrus writes backend-only
- **2026-06-07:** No full user↔agent chat logs in Walrus; store User Profile & Interaction Summaries by Sui address

- **2026-06-07:** Realtime = Socket.io Shared World (Variant A)
  - **Почему:** меньше boilerplate, rooms/reconnect из коробки
  - **Пересмотреть:** 2026-07-15 (после хакатона)

- **2026-06-07:** Не храним полные user↔agent чаты в Walrus. Храним User Profile & Interaction Summaries по Sui-адресу
  - **Почему:** приватность + судьи видят before/after без PII
  - **Пересмотреть:** 2026-07-15

- **2026-06-07:** Walrus storage для множества мелких JSON делаем через Quilt batching; latest pointers храним вне Walrus (off-chain index)
  - **Почему:** Walrus per-blob metadata overhead, Quilt рекомендован в документации
  - **Пересмотреть:** 2026-07-15 (возможный перенос latest pointer на Sui dynamic fields)

- **2026-06-07:** Repo = monorepo (pnpm workspaces)
  - **Почему:** общий контракт событий + общие типы/схемы, меньше рассинхрона
  - **Пересмотреть:** 2026-07-15

- **2026-06-07:** Realtime = Socket.io Shared World (Variant A)
  - **Почему:** reconnect/rooms из коробки; сильная демонстрация coordination
  - **Пересмотреть:** 2026-07-15

- **2026-06-07:** Walrus write-path = backend-only
  - **Почему:** безопасность ключей, контроль схем, rate-limit, anti-spam
  - **Пересмотреть:** 2026-07-15

- **2026-06-07:** User memory strategy: не храним полные user↔agent чаты в Walrus; храним User Profile & Interaction Summaries по Sui-адресу (без PII)
  - **Почему:** приватность + судьи видят before/after (“Prediction Roast / Fan Twin”)
  - **Пересмотреть:** 2026-07-15

- **2026-06-07:** Walrus storage for many small JSON = Quilt batching (Quilt-first)
  - **Почему:** подтверждено документацией (encoded size ~5× + per-blob metadata overhead; Quilt рекомендован для many small files)
  - **Latest pointers:** хранить вне Walrus (MVP: off-chain index + snapshot-to-file; Sui dynamic fields v2)
  - **Пересмотреть:** 2026-07-15

- **2026-06-07:** Scene composition = Modular (не “комната одной картинкой”)
  - **Почему:** интерактивность/hover/state объектов, корректный layering, расширяемость комнат
  - **Пересмотреть:** 2026-07-15

- **2026-06-08:** Round 2 outcome: Vertical Slice Realtime UI (локально)
  - **Готово:** backend Socket.io world:join→world:state + agent:thought; frontend показывает 5 агентов, thought bubbles, клик→модалка
  - **Осталось:** починить shared typecheck (tsc missing) и зафиксировать Round 2 как “зелёный”
  - **Пересмотреть:** 2026-06-10

- **2026-06-08:** Round 2 завершён: Realtime Vertical Slice (Socket.io + Phaser + React)
  - **Готово:** backend emits world:state + agent:thought; frontend отображает 5 агентов, thought bubbles, клик→AgentModal
  - **Стабильность:** shared typecheck проходит; backend /health и / доступны
  - **Пересмотреть:** 2026-06-10 (перед началом Walrus интеграции)

- **2026-06-08:** Identity (MVP) = Guest identity (localStorage guestId) вместо Sui wallet auth
  - **Почему:** ускоряет демонстрацию memory before/after; снижает риск дедлайна
  - **Заменить на:** Sui wallet auth (nonce+signature+JWT)
  - **Пересмотреть:** 2026-06-12

- **2026-06-08:** Walrus Memory integration (Node.js) = MemWal (`@mysten-incubation/memwal`)
  - **Почему:** официальный клиент для Walrus Memory; соответствует требованиям хакатона
  - **Пересмотреть:** 2026-07-15

- **2026-06-08:** MemWal SDK chosen for Walrus Memory integration (Node.js backend)
  - **Пакет:** `@mysten-incubation/memwal`
  - **Entrypoint:** `MemWal.create({ key, accountId, serverUrl, namespace })`
  - **Relayer:** `https://relayer.memory.walrus.xyz` (Mainnet)
  - **Пересмотреть:** 2026-07-15

- **2026-06-08:** UserSummary persistence switched to Walrus Memory (MemWal) in backend
  - **Путь:** STORAGE_BACKEND=memwal
  - **Проверка:** `/api/me/disagree` возвращает `meta.storage=memwal`, данные сохраняются между refresh
  - **Пересмотреть:** 2026-06-12 (переход guestId → suiAddress)

- **2026-06-08:** Admin endpoints protected by `x-admin-token` (MVP)
  - **Почему:** нужно управлять демо (day+N / evolve) без Sui auth
  - **Пересмотреть:** 2026-06-12 (замена на Sui admin allowlist)

- **2026-06-08:** Admin endpoints protected via `x-admin-token` header (MVP)
  - **Почему:** управляем демо (day+N) без Sui auth
  - **Пересмотреть:** 2026-06-12

- **2026-06-08:** MemWal writes in MVP are fire-and-forget (no waitForRememberJob in HTTP path)
  - **Почему:** relayer timeouts не должны ронять backend; demo важнее строгой синхронности
  - **Риск:** возможна краткая задержка before/after после клика
  - **Пересмотреть:** 2026-06-12 (очередь/ретраи/async jobs)

- **2026-06-08:** Dev-only: socket.io client connects directly to backend URL (no Vite ws proxy)
  - **Почему:** меньше dev ошибок EPIPE/ECONNRESET, ближе к прод
  - **Прод:** same-origin или строгий CORS
  - **Пересмотреть:** 2026-06-12

- **2026-06-08:** Prod-style networking: frontend uses absolute BACKEND_URL via Vite env (no Vite proxy)
  - **Почему:** совпадает с production topology; убирает dev proxy WS errors
  - **Backend:** strict CORS allowlist via CORS_ORIGINS env
  - **Пересмотреть:** 2026-06-12 (когда появится prod domain)

- **2026-06-08:** Env separation: frontend uses only `VITE_*`; backend keeps secrets (`MEMWAL_*`, `ADMIN_TOKEN`)
  - **Почему:** Vite env попадает в бандл, секреты утекут
  - **Пересмотреть:** 2026-07-15

- **2026-06-08:** MemWal latency mitigation: server-side TTL cache for user summaries (30s)
  - **Почему:** recall может занимать 2–4s; кэш ускоряет UX без изменения API
  - **Пересмотреть:** 2026-06-12 (если будем масштабировать backend)

- **2026-06-08:** Frontend получает только `VITE_*` (public), backend хранит секреты (`MEMWAL_*`, `ADMIN_TOKEN`)
  - **Почему:** `VITE_*` попадает в client bundle; секреты утекут
  - **Пересмотреть:** 2026-07-15

- **2026-06-08:** MemWal latency mitigation = server-side TTL cache (30s) для user summary
  - **Почему:** recall 2–4s; кэш делает UX быстрым
  - **Пересмотреть:** 2026-06-12 (если будет масштабирование backend)

- **2026-06-08:** Round 5 завершён: Prod-style networking + Admin demo day+1 + stable agent spawn
  - **Готово:** VITE_BACKEND_URL, strict CORS allowlist, MemWal persistence, admin day+1 endpoint, UI button, стабильный spawn
  - **Пересмотреть:** 2026-06-12 (замена admin-token → Sui allowlist admin)

- **2026-06-08:** Sui auth message is canonical: backend generates message, frontend signs exact string
  - **Почему:** исключает "message not sane" и упрощает верификацию (strict equality)
  - **Пересмотреть:** 2026-07-15

- **2026-06-09:** Round 6 завершён: Sui wallet auth (dapp-kit) + backend canonical message + JWT
  - **Auth:** /api/auth/nonce returns canonical message; frontend signs exact string; backend verifies signature + nonce replay protection; issues JWT
  - **Admin:** role=admin via ADMIN_ALLOWLIST in env (JWT claim)
  - **Socket:** world:join accepts token and sets socket role/address
  - **Пересмотреть:** 2026-06-12 (remove wallet debug panel; polish UX)

- **2026-06-09:** Memory storage strategy: MemWal for all agent/user memories and public events (predictions, evolution); Walrus Storage/Quilt only for files/assets
  - **Почему:** соответствует критерию Walrus Memory; дешевле/удобнее, чем писать события в storage; избегаем частых on-chain writes
  - **Пересмотреть:** 2026-07-15

- **2026-06-09:** Zustand store uses subscribeWithSelector to support scene-level subscriptions (avoid missed world:state race)
  - **Почему:** Phaser scene must react to store updates even if initial state arrives before subscription
  - **Пересмотреть:** 2026-07-15

## Milestone
- **2026-06-08:** Round 3 завершён: Guest memory + Roast loop (local persistence)
  - **Готово:** /api/me/disagree обновляет profile; /api/roast использует summary; thought bubbles показывают ответы
  - **Ценность:** before/after демонстрируется без Sui auth и без Walrus (подготовка к Quilt)
  - **Пересмотреть:** 2026-06-10 (замена storage на Walrus Quilt)

## Technical Debt
- **2026-06-08:** Identity (MVP) = Guest identity (localStorage guestId) вместо Sui wallet auth
  - **Почему:** ускоряет демонстрацию memory before/after; снижает риск дедлайна
  - **Заменить на:** Sui wallet auth (nonce+signature+JWT)
  - **Пересмотреть:** 2026-06-12
- **2026-06-08:** MemWalUserSummaryStore writes append-only JSON strings; no explicit upsert keying
  - **Риск:** recall может вернуть несколько версий; выбираем newest by updatedAt (MVP OK)
  - **Триггер рефакторинга:** Round 6 (перейти на structured memories / tagging / stronger retrieval query)

## Incidents
- **2026-06-08:** Frontend Vite WS proxy errors (EPIPE/ECONNRESET) during backend restarts
  - **Причина:** dev websocket disconnect/reconnect
  - **Решение:** ignore in dev, refresh page; production unaffected

- **2026-06-08:** MemWal relayer timeout caused backend crash (AbortError)
  - **Причина:** синхронное `await memwal.waitForRememberJob` в API path
  - **Решение:** fire-and-forget writes + try/catch в recall; backend не падает от таймаута Walrus
  - **Пересмотреть:** 2026-06-12 (add retry queue / structured job tracking)

- **2026-06-08:** Backend crash on MemWal relayer timeout (AbortError)
  - **Решение:** try/catch на recall + fire-and-forget on remember
  - **Статус:** fixed

- **2026-06-08:** Admin token leaked in chat logs (rotated)
  - **Решение:** rotate ADMIN_TOKEN, update localStorage moneyball.adminToken

- **2026-06-08:** MemWal relayer rate limit 429 ("30 weighted-requests/min")
  - **Решение:** server-side coalesced write queue (debounce + backoff using retry_after_seconds)
  - **Статус:** mitigated

## Ideas
