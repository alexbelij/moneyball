import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface UserSummary {
  schemaVersion: '1.0'
  guestId: string
  updatedAt: string
  sessionsCount: number
  agentDisagreeCounts: Record<string, number>
  lastAgentId?: string
  takeaways: string[]
}

export interface UserSummaryStore {
  getOrCreate(guestId: string): Promise<UserSummary>
  recordDisagree(guestId: string, agentId: string): Promise<UserSummary>
}

export class FileUserSummaryStore implements UserSummaryStore {
  constructor(private dir = './var/user-summaries') {}

  private filePath(guestId: string) {
    return path.join(this.dir, `${guestId}.json`)
  }

  async getOrCreate(guestId: string): Promise<UserSummary> {
    await fs.mkdir(this.dir, { recursive: true })
    const f = this.filePath(guestId)

    try {
      const raw = await fs.readFile(f, 'utf8')
      return JSON.parse(raw) as UserSummary
    } catch {
      const fresh: UserSummary = {
        schemaVersion: '1.0',
        guestId,
        updatedAt: new Date().toISOString(),
        sessionsCount: 1,
        agentDisagreeCounts: {},
        takeaways: ['Day 1: no strong opinions yet.'],
      }
      await fs.writeFile(f, JSON.stringify(fresh, null, 2), 'utf8')
      return fresh
    }
  }

  async recordDisagree(guestId: string, agentId: string): Promise<UserSummary> {
    const s = await this.getOrCreate(guestId)

    s.agentDisagreeCounts[agentId] = (s.agentDisagreeCounts[agentId] ?? 0) + 1
    s.lastAgentId = agentId
    s.updatedAt = new Date().toISOString()

    const count = s.agentDisagreeCounts[agentId]
    if (count === 1) {
      s.takeaways.unshift(`You disagreed with ${agentId} for the first time.`)
    } else if (count === 3) {
      s.takeaways.unshift(`Pattern detected: you keep disagreeing with ${agentId}.`)
    } else if (count === 5) {
      s.takeaways.unshift(`Bias locked in: you almost always argue with ${agentId}.`)
    }

    // cap takeaways
    s.takeaways = s.takeaways.slice(0, 12)

    await fs.writeFile(this.filePath(guestId), JSON.stringify(s, null, 2), 'utf8')
    return s
  }
}
