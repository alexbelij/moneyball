# ADR-0001: Shared World + Socket.io

**Status:** Accepted  
**Date:** 2026-06-07

## Context
Need realtime shared room state for all visitors.

## Decision
Use Socket.io with a single shared world state on backend.

## Alternatives
- Pure WebSocket (more boilerplate)
- Per-user simulation (fails coordination demo)

## Consequences
- Backend must be long-running (not Vercel serverless)
