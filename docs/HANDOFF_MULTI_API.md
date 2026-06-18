<!-- HANDOFF_MULTI_API.md | 2026-06-18 -->

# ТЗ: Multi-API интеграция + OddsProvider

> Для другого Viktor-агента с нулевым контекстом.
> Оценка: ~15–20 вызовов при экономном выполнении.

---

## 1. Контекст проекта

**Moneyball** — 5 AI-агентов в SNES-стиле, предсказывающих результаты FIFA World Cup 2026. Каждый агент использует свою методологию (см. ниже). Бэкенд на Express + TypeScript, монорепо pnpm.

**Репо:** `github.com/anna-stolbovskaja/moneyball` (приватный)
**Ветка для работы:** создать от `main` (`107d32e`), имя `task/T78-multi-api`
**Коммиты от:** `anna.stolbovskaja@gmail.com` / `Anna Stolbovskaja`
**НЕ мержить.** Только ветка + push.

---

## 2. Текущее состояние

### 2.1 Уже подключено

| Что | Файл | Статус |
|-----|-------|--------|
| `FootballDataProvider` | `apps/backend/src/matches/footballDataProvider.ts` | ✅ live — расписание/результаты WC2026 |
| `FOOTBALL_DATA_TOKEN` | env var на Render | ✅ установлен |
| FIFA ranking → `teamStrength` | `apps/backend/src/matches/fifaRankings.ts` | ✅ live (ветка `task/T77-fifa-ranking`, будет смержена) |

### 2.2 Что ещё synthetic (нужно сделать live)

В файле `apps/backend/src/matches/dataSource.ts` (`MODEL_INPUTS`):

| key | label | source сейчас | Что нужно |
|-----|-------|---------------|-----------|
| `homeAdvantage` | Home advantage | `manual` | Оставить manual — это осознанное решение |
| `narrativeSentiment` | Narrative sentiment | `synthetic` | Подключить реальные данные (форма команд, H2H) через api-football.com |
| `syntheticOdds` | Bookmaker odds | `synthetic` | **Главная задача** — реальные коэффициенты через api-football.com |

---

## 3. Агенты и их методологии

Файл: `apps/backend/src/matches/predictionEngine.ts`

| Agent ID | Methodology | Что использует |
|----------|-------------|----------------|
| `dr_morgan` | `weighted_metrics` | `teamStrength` + `homeAdvantage` → margin → pick |
| `scout_alvarez` | `narrative_sentiment` | matchday-salted hash (сейчас synthetic) |
| `viktor_kane` | `contrarian_inversion` | инвертирует прогноз dr_morgan при высокой уверенности |
| `sofia_mendes` | `expected_value` | сравнивает «true probability» с «market odds» → ищет value bet |
| `madame_pythia` | `deterministic_mysticism` | нумерология/астрология, не трогать |

---

## 4. Задача A — OddsProvider для Sofia Mendes (ПРИОРИТЕТ)

### Что сделать

Создать `apps/backend/src/matches/oddsProvider.ts` — адаптер для api-football.com, который возвращает реальные букмекерские коэффициенты 1X2.

### API: api-football.com

- **Base URL:** `https://v3.football.api-sports.io`
- **Auth header:** `x-apisports-key: <API_FOOTBALL_KEY>`
- **Endpoint:** `GET /odds?fixture={fixtureId}&bookmaker=8` (bookmaker 8 = Bet365, самый популярный)
- **Альтернатива:** `GET /odds?league=1&season=2026` (league 1 = World Cup)
- **Rate limit:** 10 req/min (free plan), кэшировать результаты!
- **Документация:** https://www.api-football.com/documentation-v3#tag/Odds

### Маппинг fixture ID

api-football.com использует свои fixture ID, не совпадающие с football-data.org. Нужно:
1. `GET /fixtures?league=1&season=2026` — получить все матчи WC2026
2. Маппинг по `homeTeam + awayTeam + date` к нашим match ID (`fd:XXXXX`)
3. Кэшировать маппинг в памяти (Map)

### Интерфейс

```typescript
// apps/backend/src/matches/oddsProvider.ts

export interface MatchOdds {
  matchId: string       // наш id (fd:XXXXX)
  homeWin: number       // коэффициент на 1
  draw: number          // коэффициент на X
  awayWin: number       // коэффициент на 2
  bookmaker: string     // "Bet365" и т.д.
  updatedAt: string     // ISO timestamp
}

export class OddsProvider {
  constructor(private readonly apiKey: string) {}
  
  /** Получить коэффициенты для матча. Кэшировать на 30 минут. */
  async getOdds(matchId: string, homeTeam: string, awayTeam: string): Promise<MatchOdds | null>
}
```

### Интеграция в predictionEngine.ts

В функции `sofiaMendes()`:
- Сейчас `pMarket` рассчитывается синтетически из `teamStrength` + noise
- Нужно: если есть реальные odds → `pMarket[o] = 1 / odds[o]` (нормализовать сумму до 1.0 с учётом маржи букмекера)
- Fallback: если odds недоступны → текущая синтетическая формула

```typescript
// Пример интеграции (упрощённо):
function sofiaMendes(m: Match, p: Record<string, number>, odds?: MatchOdds): AgentPick {
  // ... pTrue calculation stays the same ...
  
  const pMarket: Record<PickCode, number> = {}
  if (odds) {
    // Real bookmaker odds → implied probabilities
    const total = 1/odds.homeWin + 1/odds.draw + 1/odds.awayWin
    pMarket['1'] = (1/odds.homeWin) / total
    pMarket['X'] = (1/odds.draw) / total  
    pMarket['2'] = (1/odds.awayWin) / total
  } else {
    // Existing synthetic fallback
    // ... current noise-based code ...
  }
  // ... rest unchanged ...
}
```

### Прокидывание odds в predictionEngine

В `matchWorker.ts` → `predictMatch()` — нужно передать odds как опциональный параметр. Добавить `odds?: MatchOdds` в `predictMatch()` и прокинуть в `sofiaMendes`.

### Env var

Имя: `API_FOOTBALL_KEY`
В `apps/backend/src/config/env.ts` добавить:
```typescript
API_FOOTBALL_KEY: process.env.API_FOOTBALL_KEY ?? '',
```

---

## 5. Задача B — Narrative enrichment для Scout Alvarez

### Что сделать

Обогатить `scoutAlvarez()` реальными данными: формой команд (last 5 games), H2H.

### API

Тот же api-football.com:
- `GET /teams/statistics?league=1&season=2026&team={teamId}` — статистика
- `GET /fixtures/headtohead?h2h={team1Id}-{team2Id}&last=5` — H2H

### Интеграция

Создать `apps/backend/src/matches/formProvider.ts`:

```typescript
export interface TeamForm {
  team: string
  last5: ('W' | 'D' | 'L')[]  // last 5 results
  formScore: number             // 0.0–1.0 (W=1, D=0.5, L=0)
}

export class FormProvider {
  constructor(private readonly apiKey: string) {}
  async getForm(teamName: string): Promise<TeamForm | null>
  async getH2H(team1: string, team2: string): Promise<{ team1Wins: number, draws: number, team2Wins: number } | null>
}
```

В `scoutAlvarez()` — заменить `hash01(`gut:...`)` на:
```typescript
const formDiff = (homeForm?.formScore ?? 0.5) - (awayForm?.formScore ?? 0.5)
const gut = 0.5 + formDiff * 0.5  // normalize to [0, 1]
```

Fallback: если API недоступен → текущий hash.

---

## 6. Задача C — Дополнительные API (RapidAPI / football-data.org enrichment)

### RapidAPI

- **Host:** `v3.football.api-sports.io` (тот же api-football.com, но через RapidAPI)
- **Auth:** `x-rapidapi-key: <RAPIDAPI_KEY>`, `x-rapidapi-host: v3.football.api-sports.io`
- Использовать как **fallback** если прямой api-football.com не отвечает
- Env var: `RAPIDAPI_KEY`

### football-data.org (уже подключён)

Уже используется для матчей. Можно дополнительно тянуть:
- `GET /v4/competitions/WC/standings` — таблицу групп (для enrichment)
- `GET /v4/teams/{id}` — состав команды

### Env vars для env.ts

```typescript
API_FOOTBALL_KEY: process.env.API_FOOTBALL_KEY ?? '',
RAPIDAPI_KEY: process.env.RAPIDAPI_KEY ?? '',
```

---

## 7. Задача D — dataSource.ts обновление

После подключения каждого feed — обновить `apps/backend/src/matches/dataSource.ts`:

```typescript
export const MODEL_INPUTS_VERSION = 3  // bump!

// narrativeSentiment:
{
  key: 'narrativeSentiment',
  source: 'live',  // было 'synthetic'
  detail: 'Team form (last 5 matches) and H2H record from api-football.com. Fallback to hash if API unavailable.',
},

// syntheticOdds → переименовать key:
{
  key: 'bookmakerOdds',
  label: 'Bookmaker odds',
  source: 'live',  // было 'synthetic'
  detail: 'Real 1X2 odds from api-football.com (Bet365 primary). Used by Sofia Mendes for EV calculation. Fallback to synthetic odds if unavailable.',
},
```

Обновить `headline`:
```
'Model inputs v3: team strength from FIFA ranking, bookmaker odds from api-football.com, team form from api-football.com. Home advantage remains a fixed manual term.'
```

---

## 8. API ключи

Будут установлены как env vars на Render. Имена:

| Env var | API | Значение |
|---------|-----|----------|
| `FOOTBALL_DATA_TOKEN` | football-data.org | уже установлен |
| `API_FOOTBALL_KEY` | api-football.com | `77e3ca2d6007523289d196e95852900c` |
| `RAPIDAPI_KEY` | rapidapi.com | `f78c84ea09msh0f9688c4dd16e12p166a0ajsn9b3c0b12954a` |

---

## 9. Структура файлов

### Новые файлы
```
apps/backend/src/matches/oddsProvider.ts     # OddsProvider class
apps/backend/src/matches/formProvider.ts     # FormProvider class  
```

### Изменяемые файлы
```
apps/backend/src/matches/predictionEngine.ts  # sofiaMendes(), scoutAlvarez() — добавить real data params
apps/backend/src/matches/matchWorker.ts       # прокинуть odds/form в predictMatch()
apps/backend/src/matches/dataSource.ts        # обновить sources, version, headline
apps/backend/src/config/env.ts                # добавить API_FOOTBALL_KEY, RAPIDAPI_KEY
apps/backend/src/index.ts                     # инициализировать OddsProvider, FormProvider
```

### НЕ трогать
```
apps/backend/src/matches/fifaRankings.ts      # уже готов
apps/backend/src/matches/footballDataProvider.ts  # уже работает
apps/backend/src/matches/mysticism/           # madame_pythia — не трогать
```

---

## 10. Порядок выполнения (оптимальный)

1. **env.ts** — добавить 2 env var (1 мин)
2. **oddsProvider.ts** — новый файл (основная работа)
3. **formProvider.ts** — новый файл
4. **predictionEngine.ts** — добавить optional params `odds?`, `form?`; обновить sofiaMendes + scoutAlvarez с fallback
5. **matchWorker.ts** — инициализация провайдеров + прокидка данных
6. **index.ts** — создание экземпляров провайдеров при наличии ключей
7. **dataSource.ts** — bump version, обновить sources
8. **Коммит + push** ветка `task/T78-multi-api`

---

## 11. Важные ограничения

- **Детерминизм:** Предсказания должны оставаться детерминистичными для одного и того же матча. Коэффициенты кэшируются и НЕ меняются после первого запроса для данного матча.
- **Fallback обязателен:** Если API не отвечает → использовать текущие synthetic формулы. Никогда не крашить.
- **Rate limits:** api-football.com free tier = 100 req/day, 10 req/min. Кэшировать агрессивно.
- **Кэш в памяти:** Простой `Map<string, {data, timestamp}>`, TTL 30 минут. Не в базу (у нас нет БД, только MemWal).
- **Team name matching:** football-data.org возвращает `shortName` (напр. "Germany"), api-football.com может вернуть "Germany" или "Deutschland". Нужен fuzzy matching или маппинг.
