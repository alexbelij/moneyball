import type { Request, Response, NextFunction } from 'express'
import { env } from '../config/env'

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.header('x-admin-token')
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 8) {
    return res.status(500).json({ ok: false, error: 'ADMIN_TOKEN_NOT_CONFIGURED' })
  }
  if (!token || token !== env.ADMIN_TOKEN) {
    return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  }
  next()
}
