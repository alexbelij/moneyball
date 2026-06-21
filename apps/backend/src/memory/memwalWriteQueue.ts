/**
 * MemWalWriteQueue | v0.3.0 | 2026-06-21
 * Purpose: Coalesce and throttle MemWal remember() calls to mitigate 429 rate limits.
 * T76: remember callback may return blob_id; optional onComplete callback for post-write.
 * TASK 3: optional on-disk journal — pending entries survive process restarts.
 */

import type { WriteJournal } from './writeJournal'

type Pending = {
  key: string
  text: string
  nextAtMs: number
  attempts: number
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function parseRetryAfterSeconds(err: any): number | null {
  try {
    const raw = typeof err?.cause === 'string' ? err.cause : null
    if (!raw) return null
    const obj = JSON.parse(raw)
    const s = Number(obj?.retry_after_seconds)
    return Number.isFinite(s) && s > 0 ? s : null
  } catch {
    return null
  }
}

export interface MemWalWriteQueueOpts {
  debounceMs: number
  minIntervalMs: number
  /** Called after a successful write with the queue key and optional blob_id. */
  onComplete?: (key: string, blobId?: string) => void
  /** Optional on-disk journal for crash-resilient pending writes. */
  journal?: WriteJournal
}

export class MemWalWriteQueue {
  private pendingByKey = new Map<string, Pending>()
  private running = false
  private lastWriteAtMs = 0

  constructor(
    private remember: (text: string) => Promise<string | void>,
    private opts: MemWalWriteQueueOpts = { debounceMs: 1500, minIntervalMs: 1200 },
  ) {
    // TASK 3: reload any pending entries from the on-disk journal
    if (opts.journal) {
      const pending = opts.journal.loadPending()
      for (const entry of pending) {
        this.pendingByKey.set(entry.key, {
          key: entry.key,
          text: entry.text,
          nextAtMs: Date.now() + this.opts.debounceMs,
          attempts: 0,
        })
      }
      if (pending.length > 0) {
        console.log(`[writeQueue] restored ${pending.length} pending entries from journal`)
        this.kick()
      }
    }
  }

  enqueue(key: string, text: string) {
    const now = Date.now()
    this.pendingByKey.set(key, {
      key,
      text,
      nextAtMs: now + this.opts.debounceMs,
      attempts: 0,
    })
    // TASK 3: journal the pending entry to disk
    this.opts.journal?.append({ key, text, enqueuedAt: now })
    this.kick()
  }

  private kick() {
    if (this.running) return
    this.running = true
    void this.loop()
  }

  private pickNext(): Pending | null {
    let best: Pending | null = null
    for (const p of this.pendingByKey.values()) {
      if (!best || p.nextAtMs < best.nextAtMs) best = p
    }
    return best
  }

  private async loop() {
    try {
      while (this.pendingByKey.size > 0) {
        const next = this.pickNext()
        if (!next) break

        const waitMs = Math.max(0, next.nextAtMs - Date.now())
        if (waitMs > 0) await sleep(waitMs)

        const sinceLast = Date.now() - this.lastWriteAtMs
        if (sinceLast < this.opts.minIntervalMs) {
          await sleep(this.opts.minIntervalMs - sinceLast)
        }

        const current = this.pendingByKey.get(next.key)
        if (!current) continue

        try {
          const blobId = await this.remember(current.text)
          this.lastWriteAtMs = Date.now()
          this.pendingByKey.delete(current.key)
          // TASK 3: mark as done in the on-disk journal
          this.opts.journal?.markDone(current.key)
          this.opts.onComplete?.(current.key, typeof blobId === 'string' ? blobId : undefined)
        } catch (e: any) {
          const retryAfter = parseRetryAfterSeconds(e)
          const backoffMs =
            retryAfter != null
              ? retryAfter * 1000
              : Math.min(60_000, 1000 * Math.pow(2, current.attempts))

          current.attempts += 1
          current.nextAtMs = Date.now() + backoffMs
          this.pendingByKey.set(current.key, current)
        }
      }
    } finally {
      this.running = false
      if (this.pendingByKey.size > 0) this.kick()
    }
  }
}
