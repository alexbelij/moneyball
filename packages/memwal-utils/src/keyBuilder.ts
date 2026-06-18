/**
 * @module keyBuilder
 *
 * Type-safe key construction helpers for MemWal's text-prefix recall pattern.
 *
 * ### Why key builders?
 *
 * MemWal has no structured metadata (as of SDK v0.0.7). The only way to
 * distinguish record types is by text prefix:
 *
 * ```
 * "myapp:prediction agent=dr_morgan match=GER-SCO ..."
 * "myapp:evolution  agent=dr_morgan version=5 ..."
 * "myapp:user       userId=0x8a71... ..."
 * ```
 *
 * Raw string keys scattered across the codebase are error-prone —
 * typos cause silent recall failures. `createKeyBuilder` provides a typed,
 * centralized key registry.
 *
 * @example
 * ```ts
 * import { createKeyBuilder } from '@moneyball/memwal-utils';
 *
 * // Define your key schema once
 * const Keys = createKeyBuilder('myapp', {
 *   prediction:      (agentId: string, matchId: string) =>
 *                      `prediction agent=${agentId} match=${matchId}`,
 *   evolution:       (agentId: string, version: number) =>
 *                      `evolution agent=${agentId} version=${version}`,
 *   agentParams:     (agentId: string) =>
 *                      `params agent=${agentId}`,
 *   userSummary:     (userId: string) =>
 *                      `user_summary userId=${userId}`,
 * });
 *
 * // Use everywhere — typed, autocompletable, consistent:
 * const key = Keys.prediction('dr_morgan', 'GER-SCO');
 * // → "myapp:prediction agent=dr_morgan match=GER-SCO"
 *
 * const anchor = Keys.userSummary('0x8a71');
 * // → "myapp:user_summary userId=0x8a71"
 * ```
 *
 * @packageDocumentation
 */

/* ── Types ────────────────────────────────────────────────────────── */

/**
 * A key factory is any function that takes arguments and returns
 * a suffix string (without the namespace prefix).
 */
type KeyFactory = (...args: never[]) => string;

/**
 * A schema mapping key names to factory functions.
 */
type KeySchema = Record<string, KeyFactory>;

/**
 * The resulting key builder: each factory function is wrapped to
 * prepend the namespace prefix automatically.
 */
type KeyBuilder<S extends KeySchema> = {
  readonly [K in keyof S]: (...args: Parameters<S[K]>) => string;
};

/* ── Factory ──────────────────────────────────────────────────────── */

/**
 * Create a typed key builder that prepends a namespace prefix to all keys.
 *
 * @param namespace - The namespace prefix (e.g. `"myapp"`, `"moneyball"`).
 *   Joined with the key suffix by `:`.
 * @param schema - An object mapping key names to factory functions.
 *   Each factory receives typed arguments and returns the suffix portion.
 * @returns A frozen object with the same keys, where each function
 *   returns the full prefixed key string.
 *
 * @example
 * ```ts
 * const Keys = createKeyBuilder('moneyball', {
 *   personality:       (agentId: string) => `agent/${agentId}/personality`,
 *   personalityHist:   (agentId: string, v: number) =>
 *                        `agent/${agentId}/personality_history/${v}`,
 *   sleepState:        (agentId: string) => `agent/${agentId}/sys/sleep_state`,
 *   sleepLock:         (agentId: string) => `agent/${agentId}/sys/sleep_lock`,
 *   sleepCheckpoint:   (agentId: string) => `agent/${agentId}/sys/sleep_checkpoint`,
 * });
 *
 * Keys.personality('dr_morgan');
 * // → "moneyball:agent/dr_morgan/personality"
 *
 * Keys.personalityHist('dr_morgan', 5);
 * // → "moneyball:agent/dr_morgan/personality_history/5"
 * ```
 */
export function createKeyBuilder<S extends KeySchema>(
  namespace: string,
  schema: S,
): KeyBuilder<S> {
  const builder = {} as Record<string, (...args: unknown[]) => string>;

  for (const [name, factory] of Object.entries(schema)) {
    builder[name] = (...args: unknown[]) => {
      const suffix = (factory as (...a: unknown[]) => string)(...args);
      return `${namespace}:${suffix}`;
    };
  }

  return Object.freeze(builder) as KeyBuilder<S>;
}

/* ── Convenience: Moneyball's own key schema ──────────────────────── */

/**
 * Moneyball's production key schema.
 *
 * Provided as both a working example and the actual schema used in the
 * Moneyball World Cup project. Your application should define its own
 * schema with `createKeyBuilder()`.
 *
 * @example
 * ```ts
 * import { MoneyballKeys } from '@moneyball/memwal-utils';
 *
 * MoneyballKeys.personality('dr_morgan');
 * // → "moneyball:agent/dr_morgan/personality"
 * ```
 */
export const MoneyballKeys = createKeyBuilder('moneyball', {
  /** Current agent parameters (versioned document). */
  personality: (agentId: string) => `agent/${agentId}/personality`,

  /** Historical parameter versions (for rollback). */
  personalityHistory: (agentId: string, version: number) =>
    `agent/${agentId}/personality_history/${version}`,

  /** Prefix for listing all history versions of an agent. */
  personalityHistoryPrefix: (agentId: string) =>
    `agent/${agentId}/personality_history/`,

  /** Sleep pipeline state (watermark, cooldowns). */
  sleepState: (agentId: string) => `agent/${agentId}/sys/sleep_state`,

  /** Monotonic resolved-outcome counter (interaction path writer). */
  resolvedCounter: (agentId: string) =>
    `agent/${agentId}/sys/resolved_counter`,

  /** CAS + TTL sleep lock (prevents concurrent sleep runs). */
  sleepLock: (agentId: string) => `agent/${agentId}/sys/sleep_lock`,

  /** Crash-recovery checkpoint for interrupted sleep runs. */
  sleepCheckpoint: (agentId: string) =>
    `agent/${agentId}/sys/sleep_checkpoint`,
});
