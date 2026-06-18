/**
 * rateLimit | v0.2.0 | 2026-06-17
 * Purpose: Simple per-key rate limiter (in-memory, single instance).
 *
 * T56: LIMITATION — in-memory, per-process. Resets on redeploy and does not
 * share state across instances. Acceptable for the hackathon (Render single
 * instance). For multi-instance, replace with Redis sliding-window.
 *
 * T56: added periodic sweep — every 60s, stale entries older than 2× the
 * minimum interval are pruned so the Map cannot grow unbounded.
 */

const SWEEP_INTERVAL_MS = 60_000

export class SimpleRateLimiter {
  private lastAt = new Map<string, number>()
  private sweepTimer: ReturnType<typeof setInterval> | null = null

  constructor(private minIntervalMs: number) {
    // T56: start background sweep to keep the Map bounded.
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS)
    if (this.sweepTimer && typeof this.sweepTimer === 'object' && 'unref' in this.sweepTimer) {
      this.sweepTimer.unref()
    }
  }

  allow(key: string): boolean {
    const now = Date.now()
    const last = this.lastAt.get(key) ?? 0
    if (now - last < this.minIntervalMs) return false
    this.lastAt.set(key, now)
    return true
  }

  /** T56: prune stale entries — anything older than 2× interval is no longer rate-limited. */
  private sweep() {
    const cutoff = Date.now() - this.minIntervalMs * 2
    for (const [key, ts] of this.lastAt) {
      if (ts < cutoff) {
        this.lastAt.delete(key)
      }
    }
  }

  /** Cleanup for tests. */
  destroy() {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer)
      this.sweepTimer = null
    }
  }
}
