import type { Express } from 'express'
import { requireAdmin } from './jwtMiddleware'
import { getUserSummaryStore } from '../memory/storeFactory'

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

export function registerAdminRoutes(app: Express) {
  app.post('/api/admin/simulate/day-plus-one', requireAdmin, async (req, res) => {
    const id = getUserId(req)
    if (!id) return res.status(401).json({ ok: false, error: 'MISSING_IDENTITY' })

    const agentId = String(req.body?.agentId ?? 'dr_morgan')
    const store = getUserSummaryStore()
    const summary = await store.recordDisagree(id.userId, agentId)

    res.json({ ok: true, summary, meta: { storage: process.env.STORAGE_BACKEND ?? 'file', identity: id.kind } })
  })
}
