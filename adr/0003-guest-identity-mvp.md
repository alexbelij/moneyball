# ADR-0003: Guest identity for MVP (localStorage guestId)

**Status:** Accepted  
**Date:** 2026-06-08

## Context
Sui wallet auth занимает время и повышает риск дедлайна. Нужна демонстрация memory before/after уже сейчас.

## Decision
Используем guest identity: `guestId` хранится в localStorage и передаётся в backend как `x-guest-id`.

## Consequences
- Нельзя доказать “это один и тот же пользователь” криптографически.
- В Round 4/5 заменяем на Sui wallet auth (nonce+signature+JWT), ключи памяти переедут на suiAddress.