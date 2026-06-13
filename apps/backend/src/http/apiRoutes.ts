import type { Express } from 'express'
import { getUserSummaryStore } from '../memory/storeFactory'
import { AgentPersonaService } from '../agents/agentPersonaService'

function getGuestId(req: any): string | null {
  const v = req.header('x-guest-id')
  if (!v || typeof v !== 'string') return null
  if (v.length < 10 || v.length > 80) return null
  return v
}

function getUserId(req: any): { userId: string; kind: 'sui' | 'guest' } | null {
  if (req.viewer?.suiAddress) return { userId: `sui:${String(req.viewer.suiAddress).toLowerCase()}`, kind: 'sui' }
  const guestId = getGuestId(req)
  if (guestId) return { userId: `guest:${guestId}`, kind: 'guest' }
  return null
}

export function registerApiRoutes(app: Express, personas: AgentPersonaService = new AgentPersonaService()) {
  app.get('/api/me/summary', async (req, res) => {
    const id = getUserId(req)
    if (!id) return res.status(401).json({ ok: false, error: 'MISSING_IDENTITY' })

    const store = getUserSummaryStore()
    const summary = await store.getOrCreate(id.userId)

    res.json({ ok: true, summary, meta: { storage: process.env.STORAGE_BACKEND ?? 'file', identity: id.kind } })
  })

  app.post('/api/me/disagree', async (req, res) => {
    const id = getUserId(req)
    if (!id) return res.status(401).json({ ok: false, error: 'MISSING_IDENTITY' })
    const agentId = String(req.body?.agentId ?? '')
    if (!agentId) return res.status(400).json({ ok: false, error: 'MISSING_AGENT_ID' })

    const store = getUserSummaryStore()
    const summary = await store.recordDisagree(id.userId, agentId)

    res.json({ ok: true, summary, meta: { storage: process.env.STORAGE_BACKEND ?? 'file', identity: id.kind } })
  })

  app.post('/api/roast', async (req, res) => {
    const id = getUserId(req)
    if (!id) return res.status(401).json({ ok: false, error: 'MISSING_IDENTITY' })
    const agentId = String(req.body?.agentId ?? '')
    if (!agentId) return res.status(400).json({ ok: false, error: 'MISSING_AGENT_ID' })

    const store = getUserSummaryStore()
    const summary = await store.getOrCreate(id.userId)
    const disagree = summary.agentDisagreeCounts[agentId] ?? 0

    // T29: personality-driven roast — pick from the agent's own roastLines,
    // deterministic per (user, agent, UTC day). Falls back to a generic line
    // for unknown agents (e.g. agents with no configured roastLines).
    const persona = personas.roastFor(agentId, id.userId)
    const text =
      persona ??
      (disagree === 0
        ? `Day 1 vibe: you haven't argued with me yet. Give it time.`
        : disagree < 3
          ? `I remember you argued with me (${disagree}x). That's… predictable.`
          : `You argue with me (${disagree}x). At this point it's your methodology, not mine.`)

    res.json({
      ok: true,
      text,
      meta: {
        disagree,
        source: persona ? 'persona' : 'generic',
        storage: process.env.STORAGE_BACKEND ?? 'file',
        identity: id.kind,
      },
    })
  })

  // T29: public thought bubbles for room cycling (flavour text, grouped by
  // live-state). Secret-free, read-only.
  app.get('/api/public/agents/:agentId/thoughts', (req, res) => {
    const agentId = String(req.params.agentId)
    const states = personas.thoughtsFor(agentId)
    if (!states) return res.status(404).json({ ok: false, error: 'UNKNOWN_AGENT' })
    res.json({ ok: true, agentId, states })
  })
}
