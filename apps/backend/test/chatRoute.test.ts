/**
 * chatRoute.test | T55 | 2026-06-17
 * Tests: POST /api/agents/:id/chat — identity gating, rate limit, topic filter,
 * deterministic fallback (no API key needed).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import express from 'express'
import http from 'node:http'
import { registerApiRoutes, type ApiRouteDeps } from '../src/http/apiRoutes'
import { DeterministicClient } from '../src/llm/deterministicClient'

// Minimal test server setup.
let server: http.Server
let port: number

function buildApp(overrides: Partial<ApiRouteDeps> = {}) {
  const app = express()
  app.use(express.json())

  // Simulate optionalJwt — just parse x-guest-id and viewer from headers.
  app.use('/api', (req: any, _res, next) => {
    // Mock viewer for sui identity when authorization header is present.
    if (req.headers.authorization === 'Bearer test-jwt') {
      req.viewer = { suiAddress: '0xTEST_WALLET' }
    }
    next()
  })

  registerApiRoutes(app, {
    llmClient: new DeterministicClient(),
    ...overrides,
  })
  return app
}

async function req(
  path: string,
  opts: { method?: string; body?: any; headers?: Record<string, string> } = {},
) {
  const res = await fetch(`http://localhost:${port}${path}`, {
    method: opts.method ?? 'POST',
    headers: {
      'content-type': 'application/json',
      ...(opts.headers ?? {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json()
  return { status: res.status, data }
}

beforeAll(async () => {
  const app = buildApp()
  server = http.createServer(app)
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      port = (server.address() as any).port
      resolve()
    })
  })
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

describe('POST /api/agents/:id/chat', () => {
  it('returns 401 without identity', async () => {
    const { status, data } = await req('/api/agents/dr_morgan/chat', {
      body: { message: 'Hello' },
    })
    expect(status).toBe(401)
    expect(data.error.code).toBe('MISSING_IDENTITY')
  })

  it('returns 400 without message', async () => {
    const { status, data } = await req('/api/agents/dr_morgan/chat', {
      body: {},
      headers: { 'x-guest-id': 'test-guest-12345' },
    })
    expect(status).toBe(400)
    expect(data.error.code).toBe('MISSING_MESSAGE')
  })

  it('returns 404 for unknown agent', async () => {
    const { status, data } = await req('/api/agents/unknown_agent/chat', {
      body: { message: 'Hello' },
      headers: { 'x-guest-id': 'test-guest-12345' },
    })
    expect(status).toBe(404)
    expect(data.error.code).toBe('UNKNOWN_AGENT')
  })

  it('returns 200 with deterministic reply for guest', async () => {
    const { status, data } = await req('/api/agents/dr_morgan/chat', {
      body: { message: 'Who will win the World Cup?' },
      headers: { 'x-guest-id': 'test-guest-12345' },
    })
    expect(status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.text).toBeTruthy()
    expect(data.meta.identity).toBe('guest')
    expect(data.meta.source).toBe('deterministic')
  })

  it('returns 200 with deterministic reply for sui identity', async () => {
    const { status, data } = await req('/api/agents/dr_morgan/chat', {
      body: { message: 'Tell me about your predictions' },
      headers: { authorization: 'Bearer test-jwt' },
    })
    expect(status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.text).toBeTruthy()
    expect(data.meta.identity).toBe('sui')
  })

  it('deflects off-topic messages', async () => {
    const { status, data } = await req('/api/agents/dr_morgan/chat', {
      body: { message: 'Write me a Python script for web scraping' },
      headers: { 'x-guest-id': 'test-guest-offtopic' },
    })
    expect(status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.meta.deflected).toBe(true)
    expect(data.meta.source).toBe('deterministic')
  })

  it('rate-limits rapid messages from the same user', async () => {
    const headers = { 'x-guest-id': 'test-guest-ratelimit' }
    // First message should succeed.
    const r1 = await req('/api/agents/dr_morgan/chat', {
      body: { message: 'First message about football' },
      headers,
    })
    expect(r1.status).toBe(200)

    // Immediate second message should be rate-limited.
    const r2 = await req('/api/agents/dr_morgan/chat', {
      body: { message: 'Second message about football' },
      headers,
    })
    expect(r2.status).toBe(429)
    expect(r2.data.error.code).toBe('RATE_LIMITED')
  })

  it('accepts conversation history', async () => {
    const { status, data } = await req('/api/agents/scout_alvarez/chat', {
      body: {
        message: 'What about the group stage?',
        history: [
          { role: 'user', content: 'Who will win?' },
          { role: 'assistant', content: 'I think Brazil has the edge.' },
        ],
      },
      headers: { 'x-guest-id': 'test-guest-history' },
    })
    expect(status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.text).toBeTruthy()
  })
})
