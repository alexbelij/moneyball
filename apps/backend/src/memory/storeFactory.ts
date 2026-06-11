import { env } from '../config/env'
import { FileUserSummaryStore } from './userSummaryStore'
import type { UserSummaryStore } from './userSummaryStore'
import { MemWalUserSummaryStore } from './memwalUserSummaryStore'

let instance: UserSummaryStore | null = null

export function getUserSummaryStore(): UserSummaryStore {
  if (instance) return instance

  if (env.STORAGE_BACKEND === 'memwal') {
    if (!env.MEMWAL_KEY || !env.MEMWAL_ACCOUNT_ID) {
      console.warn('[storeFactory] MEMWAL_KEY or MEMWAL_ACCOUNT_ID missing, fallback to file')
      instance = new FileUserSummaryStore()
      return instance
    }

    try {
      const mem = new MemWalUserSummaryStore()
      // Fire-and-forget health check (won't block server start)
      void mem.health().then(
        () => console.log('[storeFactory] MemWal health: OK'),
        (e) => console.warn('[storeFactory] MemWal health failed:', e),
      )
      instance = mem
      console.log('[storeFactory] using MemWalUserSummaryStore')
      return instance
    } catch (e) {
      console.warn('[storeFactory] MemWal init failed, fallback to file:', e)
    }
  }

  instance = new FileUserSummaryStore()
  console.log('[storeFactory] using FileUserSummaryStore')
  return instance
}
