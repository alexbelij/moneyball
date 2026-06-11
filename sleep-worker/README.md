# @moneyball/sleep-worker — MVP SleepWorker поверх MemWal

Самообучение агентов **без LLM, без embeddings, только TypeScript, только MemWal**.
Компилируется под `tsc --strict` (+ `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
E2E-симуляция (`test/simulation.ts`) доказывает реальную эволюцию: v0 → v1 → v2,
overconfidence-bias уходит в минус, слабая тема получает multiplier < 1, cooldown работает.

## Файловая структура

```
sleep-worker/
├── package.json
├── tsconfig.json                  # strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes
├── src/
│   ├── index.ts                   # public API + createSleepWorker() (composition root)
│   ├── memory/
│   │   ├── keys.ts                # ЕДИНСТВЕННОЕ место конструирования MemWal-ключей
│   │   └── MemWalClient.ts        # порт над MemWal: read / write(CAS, priority) / listKeys + Clock
│   ├── params/
│   │   ├── AgentParams.ts         # AgentParams, PARAM_BOUNDS, ParamDelta (discriminated union),
│   │   │                          # applyCalibration() — inference-side хелпер
│   │   └── AgentParamsStore.ts    # versioned store: getCached(30s) / getOrCreate /
│   │                              # commitNewVersion(CAS) / rollbackTo / history prune
│   ├── events/
│   │   └── types.ts               # PredictionEvent (целевая форма), EvolutionEvent,
│   │                              # AgentEventReader — порт над вашим AgentEventService
│   ├── reflection/
│   │   ├── metrics.ts             # чистые функции: Brier, calibration buckets, gap,
│   │   │                          # per-topic/per-version stats, capped disagree rate
│   │   └── ReflectionEngine.ts    # детерминированные дельты + shadow-eval → rollback
│   ├── evolution/
│   │   └── EvolutionEngine.ts     # ЕДИНСТВЕННЫЙ мутатор params: валидация, audit-first,
│   │                              # идемпотентность по runId, dryRun (shadow mode)
│   └── sleep/
│       ├── SleepState.ts          # SleepState, SleepCheckpoint, SleepRunResult, SleepLockRecord
│       ├── SleepStateStore.ts     # счётчики (lossy NORMAL) + COMMIT/abort/checkpoint (HIGH)
│       ├── SleepLock.ts           # CAS-lock c TTL 10 мин, кража протухшего лока через CAS
│       └── SleepWorker.ts         # оркестратор: trigger → LOCK → COLLECT → REFLECT → EVOLVE → COMMIT
└── test/
    └── simulation.ts              # e2e: FakeMemWal (CAS-корректный) + FakeEventReader
```

## Ключевые инварианты (зашиты в код)

1. **Единственная мутабельная поверхность** — `AgentParams`. Меняется только через
   `EvolutionEngine` → `AgentParamsStore.commitNewVersion()` с CAS по `memwalVersion`
   и по логической `version`.
2. **Audit-first**: `EvolutionEvent` пишется ДО изменения params. Событие без изменения —
   восстановимая аномалия; изменение без события — неаудируемая порча.
3. **History-before-pointer**: снапшот новой версии в `personality_history/{v}` пишется
   до переключения живого указателя — краш между записями не теряет версию.
4. **Watermark по `outcome.resolvedAt`**, не по `ts` события — поздно резолвящиеся
   прогнозы не теряются.
5. **Разделение сигналов**: outcomes → калибровка; disagree → только hedging
   (+ cap 20% веса на одного userId — анти-накрутка).
6. **Идемпотентность**: `runId = agentId:watermark:paramsVersion` детерминирован;
   `EvolutionEvent.id = evo_{runId}`; повторный прогон упавшего сна не применит дважды.
7. **`delta.from` must match live params** — устаревший reflection падает, а не применяется.
8. **Бюджет изменений**: Σ|delta| ≤ 0.10 за сон + cooldown 2 сна на тему + клампы границ
   проверяются дважды (Reflection clamps, Evolution re-validates — defense in depth).
9. **Shadow rollback**: Brier(vN) > Brier(vN−1) + 0.05 при n≥15 на обеих версиях →
   rollback (как новая forward-версия, история не переписывается).

## Что нужно реализовать на вашей стороне (2 адаптера)

```ts
const { worker, paramsStore } = createSleepWorker({ memwal, eventReader, dryRun: true });
```

- `MemWalClient` — обёртка над вашим MemWal-доступом + `MemWalWriteQueue`.
- `AgentEventReader` — обёртка над `AgentEventService`.

## Migration path от текущего AgentEventService

**Шаг 0 (день 0, без поведенческих изменений).**
Расширить `PredictionEvent`: добавить `paramsVersion` (для старых событий backfill `0`),
`rawConfidence`/`effectiveConfidence` (backfill = текущий `confidence`). Outcome-резолвер
начинает писать `outcome.resolvedAt`.

**Шаг 1. Индекс по resolvedAt.**
`AgentEventReader.listResolvedSince()` требует выборку «outcome.resolvedAt > X, order asc».
Если MemWal не даёт такого скана — вести компактный индекс-документ
`agent/{id}/sys/resolved_index` (append id при резолве, тем же путём, что запись outcome).

**Шаг 2. MemWalWriteQueue: приоритеты + CAS.**
Добавить `priority: HIGH | NORMAL | LOW_LOSSY` (HIGH не коалесцируется и не дропается;
LOW_LOSSY дропается первым при 429-шторме) и `awaitDurability` (HIGH-записи ждут
подтверждения). Если у MemWal нет нативного CAS — эмулировать read-verify-write;
это безопасно, т.к. sleep-джобы партиционируются по agentId на одного консьюмера,
а SleepLock даёт вторую линию защиты.

**Шаг 3. AgentParamsStore в inference path (за флагом).**
В месте, где агент формирует confidence: `applyCalibration(await paramsStore.getCached(agentId), topic, raw)`.
С params v0 это identity (bias 0, multiplier 1.0) — поведение не меняется.
Записывать `paramsVersion` и `effectiveConfidence` в каждый новый PredictionEvent.

**Шаг 4. Outcome-резолвер дёргает счётчик.**
После записи outcome: `stateStore.recordOutcomeResolved(agentId)` (NORMAL, fire-and-forget).

**Шаг 5. SleepWorker в shadow mode.**
Деплой консьюмера (`dryRun: true`): cron/queue зовёт `worker.runIfDue(agentId)`.
Неделю наблюдаете EvolutionEvent'ы с `dryRun: true` — какие дельты «хотел бы» применить агент.

**Шаг 6. Включение на пилотном агенте.**
`dryRun: false` для одного агента. Метрики: Brier по `paramsVersion` (уже в evidence
каждого EvolutionEvent), частота rollback, `consecutiveAborts`. Алерты: не спал 48ч;
3 abort подряд; rollback 2 раза подряд (= reflection нестабилен, заморозить агента).

**Шаг 7. Раскатка на всех + decommission ничего не требует** — старые поля
PredictionEvent не удаляются, AgentEventService остаётся source of truth по событиям.

## Конфиги по умолчанию

| Параметр | Значение | Где |
|---|---|---|
| learningRate | 0.15 | ReflectionConfig |
| minSamples (global/topic) | 20 / 20 | ReflectionConfig |
| calibrationGapThreshold | 0.05 | ReflectionConfig |
| maxTotalDelta за сон | 0.10 | Reflection + Evolution |
| topicCooldownSleeps | 2 | ReflectionConfig |
| rollback: excess / minSamples | 0.05 / 15 | ReflectionConfig |
| Триггер сна | 50 resolved ИЛИ 24ч и ≥10 | SleepWorkerConfig |
| Пол между снами | 60 мин | SleepWorkerConfig |
| collectLimit (окно) | 500 | SleepWorkerConfig |
| Lock TTL | 10 мин | SleepLock |
| Params cache TTL / history | 30с / 10 версий | AgentParamsStoreConfig |

## Команды

```bash
bun install          # или npm i
bun x tsc --noEmit   # typecheck (проходит чисто)
bun test/simulation.ts  # e2e-симуляция эволюции
```
