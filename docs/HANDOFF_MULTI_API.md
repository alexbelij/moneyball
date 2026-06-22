<!-- HANDOFF_MULTI_API.md | v1.1.0 | 2026-06-22 -->

# Multi-API Integration: OddsProvider + FormProvider

## Status (2026-06-22)

| Task | Status | Notes |
|------|--------|-------|
| A. OddsProvider | ✅ Done | `oddsProvider.ts` — batch-fetch WC2026 odds, 30min cache |
| B. FormProvider | ✅ Done | `formProvider.ts` — last 5 matches, 60min cache |
| C. predictionEngine v0.3 | ✅ Done | `LiveContext` param; sofiaMendes + scoutAlvarez use live data with fallback |
| D. matchWorker | ✅ Done | Passes odds/form into predictMatch |
| E. env.ts | ✅ Done | `API_FOOTBALL_KEY`, `RAPIDAPI_KEY` added |
| F. index.ts | ✅ Done | Initialises OddsProvider/FormProvider when keys are present |
| G. dataSource.ts | ✅ Done | Dynamic source (live/synthetic) based on env vars |
| Testing | ✅ Done | typecheck + vitest pass |
| Env vars on Render | ✅ Done | `API_FOOTBALL_KEY` and `RAPIDAPI_KEY` set |
| RapidAPI fallback | ⬜ Deferred | Optional: same api-football via different host |

---

## Project Context

**Moneyball** — 5 AI agents in 16-bit-inspired pixel-art style predict FIFA World Cup 2026 matches. Backend on Express + TypeScript, pnpm monorepo.

---

## New Files

### `apps/backend/src/matches/oddsProvider.ts`
- `OddsProvider` class — adapter for api-football.com (v3)
- Batch-fetches all WC2026 odds in 2 API calls (fixtures + odds)
- In-memory cache, 30-minute TTL
- Interface: `getOdds(homeTeam, awayTeam) → MatchOdds | null`

### `apps/backend/src/matches/formProvider.ts`
- `FormProvider` class — team form (last 5 matches)
- Loads WC2026 team IDs in 1 call, caches them
- Per-team form via `GET /fixtures?team={id}&last=5`
- 60-minute cache
- Interface: `getForm(teamName) → TeamForm | null`

## Modified Files

### `apps/backend/src/matches/predictionEngine.ts` (v0.2 → v0.3)
- New interface `LiveContext { odds?, homeForm?, awayForm? }`
- `scoutAlvarez()` — uses `formScore` if available, otherwise hash fallback
- `sofiaMendes()` — uses real odds if available, otherwise synthetic
- `predictMatch()` — accepts optional `ctx: LiveContext`

### `apps/backend/src/matches/matchWorker.ts`
- `MatchWorkerOptions` — new fields `oddsProvider?`, `formProvider?`
- `maybePredict()` — fetches live context before cycling through agents

### `apps/backend/src/config/env.ts`
- Added `API_FOOTBALL_KEY`, `RAPIDAPI_KEY`

### `apps/backend/src/index.ts`
- Creates `OddsProvider`/`FormProvider` when `API_FOOTBALL_KEY` is present
- Passes them to `MatchWorker`

### `apps/backend/src/matches/dataSource.ts` (v1 → v2)
- `buildModelInputs()` — dynamically determines source based on env vars
- `getDataSourceSummary()` — added `providers[]` field
- Headline generated automatically

---

## API Keys (env vars for Render)

| Env var | API | Description |
|---------|-----|-------------|
| `FOOTBALL_DATA_TOKEN` | football-data.org | Match schedule + scores |
| `API_FOOTBALL_KEY` | api-football.com | Odds + form data |
| `RAPIDAPI_KEY` | rapidapi.com | Fallback host (not yet implemented) |

---

## Remaining Work

1. **RapidAPI fallback** — in `oddsProvider.ts`, add second host `v3.football.api-sports.io` via RapidAPI header when `RAPIDAPI_KEY` is present
2. **Team name matching** — if api-football.com returns different team names, add a mapping layer
