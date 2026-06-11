/**
 * jwtMiddleware | v0.2.0 | 2026-06-09
 * Purpose: Parse Bearer JWT (optional) and enforce admin access by allowlist/role.
 * Security: strict algorithm allowlist to prevent alg confusion.
 */

import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'

type JwtPayload = { sub: string; role: 'user' | 'admin' }

function getBearer(req: Request): string | null {
  const h = req.header('authorization')
  if (!h) return null
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m?.[1] ?? null
}

export function optionalJwt(req: any, _res: Response, next: NextFunction) {
  const token = getBearer(req)
  if (!token) return next()
  try {
    const p = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload
    req.viewer = { suiAddress: String(p.sub).toLowerCase(), role: p.role }
  } catch {
    // ignore invalid token (optional)
  }
  next()
}

export function requireAdmin(req: any, res: Response, next: NextFunction) {
  const v = req.viewer
  if (!v) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' })
  const addr = String(v.suiAddress).toLowerCase()
  const isAdmin = v.role === 'admin' || env.ADMIN_ALLOWLIST.has(addr)
  if (!isAdmin) return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  next()
}
