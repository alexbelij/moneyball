export class SimpleRateLimiter {
  private lastAt = new Map<string, number>()

  constructor(private minIntervalMs: number) {}

  allow(key: string): boolean {
    const now = Date.now()
    const last = this.lastAt.get(key) ?? 0
    if (now - last < this.minIntervalMs) return false
    this.lastAt.set(key, now)
    return true
  }
}
