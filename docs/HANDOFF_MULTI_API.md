<!-- HANDOFF_MULTI_API.md | 2026-06-18 -->

# ТЗ: Multi-API интеграция + OddsProvider

## ✅ СТАТУС (2026-06-18)

| Задача | Статус | Комментарий |
|--------|--------|-------------|
| A. OddsProvider | ✅ Код написан | `oddsProvider.ts` — batch-fetch WC2026 odds, 30min cache |
| B. FormProvider | ✅ Код написан | `formProvider.ts` — last 5 matches, 60min cache |
| C. predictionEngine v0.3 | ✅ Обновлён | `LiveContext` param, sofiaMendes + scoutAlvarez используют live данные с fallback |
| D. matchWorker | ✅ Обновлён | Прокидывает odds/form в predictMatch |
| E. env.ts | ✅ Обновлён | `API_FOOTBALL_KEY`, `RAPIDAPI_KEY` добавлены |
| F. index.ts | ✅ Обновлён | Инициализирует OddsProvider/FormProvider при наличии ключей |
| G. dataSource.ts | ✅ Обновлён | Динамический source (live/synthetic) в зависимости от env vars |
| **Тестирование** | ❌ Не сделано | Нет возможности запустить tsc/vitest в sandbox (workspace: deps) |
| **Env vars на Render** | ❌ Ждёт | `API_FOOTBALL_KEY` и `RAPIDAPI_KEY` нужно установить вручную |
| **RapidAPI fallback** | ❌ Не реализован | Можно добавить позже: тот же api-football через другой хост |

**Ветка:** `task/T78-multi-api` от `107d32e` (main)
**Что осталось:** typecheck, тесты, установка env vars, опциональный RapidAPI fallback.

---

## Контекст проекта

**Moneyball** — 5 AI-агентов в SNES-стиле, предсказывающих результаты FIFA World Cup 2026. Бэкенд на Express + TypeScript, монорепо pnpm.

**Репо:** `github.com/anna-stolbovskaja/moneyball` (приватный)
**Коммиты от:** `anna.stolbovskaja@gmail.com` / `Anna Stolbovskaja`
**НЕ мержить.** Только ветка + push.

---

## Новые файлы

### `apps/backend/src/matches/oddsProvider.ts`
- Класс `OddsProvider` — адаптер api-football.com (v3)
- Batch-fetch всех WC2026 odds за 2 API-вызова (fixtures + odds)
- Кэш в памяти, TTL 30 минут
- Интерфейс: `getOdds(homeTeam, awayTeam) → MatchOdds | null`

### `apps/backend/src/matches/formProvider.ts`
- Класс `FormProvider` — форма команд (last 5 matches)
- Загружает WC2026 team IDs за 1 вызов, кэширует
- Per-team форма через `GET /fixtures?team={id}&last=5`
- Кэш 60 минут
- Интерфейс: `getForm(teamName) → TeamForm | null`

## Изменённые файлы

### `apps/backend/src/matches/predictionEngine.ts` (v0.2 → v0.3)
- Новый интерфейс `LiveContext { odds?, homeForm?, awayForm? }`
- `scoutAlvarez()` — использует `formScore` если есть, иначе hash fallback
- `sofiaMendes()` — использует реальные odds если есть, иначе синтетические
- `predictMatch()` — принимает опциональный `ctx: LiveContext`

### `apps/backend/src/matches/matchWorker.ts`
- `MatchWorkerOptions` — новые поля `oddsProvider?`, `formProvider?`
- `maybePredict()` — запрашивает live context перед циклом по агентам

### `apps/backend/src/config/env.ts`
- `API_FOOTBALL_KEY`, `RAPIDAPI_KEY`

### `apps/backend/src/index.ts`
- Создаёт `OddsProvider`/`FormProvider` при наличии `API_FOOTBALL_KEY`
- Передаёт в `MatchWorker`

### `apps/backend/src/matches/dataSource.ts` (v1 → v2)
- `buildModelInputs()` — динамически определяет source на основе env vars
- `getDataSourceSummary()` — добавлено поле `providers[]`
- Headline генерируется автоматически

---

## API ключи (env vars для Render)

| Env var | API | Описание |
|---------|-----|----------|
| `FOOTBALL_DATA_TOKEN` | football-data.org | ✅ Уже установлен |
| `API_FOOTBALL_KEY` | api-football.com | Odds + form. Значение: `77e3ca2d6007523289d196e95852900c` |
| `RAPIDAPI_KEY` | rapidapi.com | Fallback (не реализован). Значение: `f78c84ea09msh0f9688c4dd16e12p166a0ajsn9b3c0b12954a` |

---

## Что осталось для другого Viktor'а

1. **Typecheck** — запустить `pnpm typecheck` и исправить ошибки (если есть)
2. **RapidAPI fallback** — в `oddsProvider.ts` добавить второй хост `v3.football.api-sports.io` через RapidAPI header при наличии `RAPIDAPI_KEY`
3. **Team name matching** — если api-football.com возвращает другие имена команд, добавить маппинг
4. **Тесты** — добавить unit-тесты для OddsProvider/FormProvider (mock fetch)
