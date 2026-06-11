/**
 * Single source of truth for all MemWal key construction.
 * No raw string keys anywhere else in the codebase.
 *
 * Layout (per agent):
 *   agent/{agentId}/personality                  — current AgentParams (versioned doc)
 *   agent/{agentId}/personality_history/{v}      — last N param versions (rollback)
 *   agent/{agentId}/sys/sleep_state              — SleepState (watermarks, counters)
 *   agent/{agentId}/sys/sleep_lock               — SleepLock (CAS + TTL)
 *   agent/{agentId}/sys/sleep_checkpoint         — SleepCheckpoint (crash recovery)
 *
 * Prediction / evolution events stay in AgentEventService namespaces — we only
 * read/append through AgentEventReader, never construct those keys here.
 */

export const MemWalKeys = {
  personality: (agentId: string): string => `agent/${agentId}/personality`,

  personalityHistory: (agentId: string, version: number): string =>
    `agent/${agentId}/personality_history/${version}`,

  personalityHistoryPrefix: (agentId: string): string =>
    `agent/${agentId}/personality_history/`,

  sleepState: (agentId: string): string => `agent/${agentId}/sys/sleep_state`,

  sleepLock: (agentId: string): string => `agent/${agentId}/sys/sleep_lock`,

  sleepCheckpoint: (agentId: string): string =>
    `agent/${agentId}/sys/sleep_checkpoint`,
} as const;
