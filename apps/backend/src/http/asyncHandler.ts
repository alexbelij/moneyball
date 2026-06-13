/**
 * asyncHandler | v1.0.0 | 2026-06-14
 * Purpose: Wrap async Express route handlers so rejected promises become
 * 500 JSON responses instead of unhandled rejections that crash the process.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express'

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>

export function asyncHandler(fn: AsyncRouteHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error('[asyncHandler] unhandled route error:', err)
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: 'INTERNAL' })
      }
    })
  }
}
