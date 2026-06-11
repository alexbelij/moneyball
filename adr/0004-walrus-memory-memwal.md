# ADR-0004: Walrus Memory via MemWal in backend

**Status:** Accepted  
**Date:** 2026-06-08

## Context
Хакатон требует Walrus Memory (not just storage). Память должна реально менять поведение агента (before/after). Браузер не должен писать в Walrus напрямую.

## Decision
Backend использует `@mysten-incubation/memwal` (`MemWal.create()`).
Все операции remember/recall/query выполняются сервером. Клиент взаимодействует только с backend API.

## Alternatives
- Direct Walrus storage (слишком низкоуровнево, не даёт memory UX/semantic recall)
- Client-side MemWal (утечка delegate key / невозможность безопасной записи)

## Consequences
- Delegate key и accountId хранятся в `.env` на backend (не коммитить).
- Нужен relayer (`https://relayer.memory.walrus.xyz` mainnet).
- Fallback: FileUserSummaryStore при ошибке MemWal (dev mode / outage).