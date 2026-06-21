/**
 * authRateLimit.test | 2026-06-21
 * Validates that auth endpoints are rate-limited (429 on burst).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import http from 'node:http'
import { registerAuthRoutes } from '../src/http/authRoutes'

let server: http.Server
let port: number

async function req(path: string, body: object) {
  const res = await fetch(`http://localhost:${port}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json() }
}

beforeAll(async () => {
  const app = express()
  app.use(express.json())
  registerAuthRoutes(app)
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      port = (server.address() as any).port
      resolve()
    })
  })
})

afterAll(() => { server?.close() })

describe('auth rate limiting', () => {
  it('POST /api/auth/nonce returns 429 on rapid burst', async () => {
    const addr = '0x' + 'a'.repeat(64)
    const r1 = await req('/api/auth/nonce', { suiAddress: addr })
    expect(r1.status).toBe(200)

    const r2 = await req('/api/auth/nonce', { suiAddress: addr })
    expect(r2.status).toBe(429)
    expect(r2.data.error.code).toBe('RATE_LIMITED')
  })

  it('POST /api/auth/verify returns 429 on rapid burst', async () => {
    const addr = '0x' + 'b'.repeat(64)
    const r1 = await req('/api/auth/verify', { suiAddress: addr, nonce: 'n', message: 'm', signature: 's' })
    expect(r1.status).not.toBe(429)

    const r2 = await req('/api/auth/verify', { suiAddress: addr, nonce: 'n', message: 'm', signature: 's' })
    expect(r2.status).toBe(429)
    expect(r2.data.error.code).toBe('RATE_LIMITED')
  })

  it('different addresses are rate-limited independently', async () => {
    const addr1 = '0x' + 'c'.repeat(64)
    const addr2 = '0x' + 'd'.repeat(64)
    const r1 = await req('/api/auth/nonce', { suiAddress: addr1 })
    expect(r1.status).toBe(200)
    const r2 = await req('/api/auth/nonce', { suiAddress: addr2 })
    expect(r2.status).toBe(200)
  })
})
