/**
 * verifiability.test | v1.0.0 | 2026-06-18
 * Purpose: Lock the T64 verifiability surface contract -- response shape,
 *          public identifiers, per-agent data, and "how to verify" recipe.
 */

import { describe, expect, it, beforeEach } from 'vitest'
import { AgentEventService } from '../src/agents/agentEventService'
import {
  registerVerifiabilityRoutes,
  type VerifiabilityResponse,
} from '../src/http/verifiabilityRoutes'

const AGENT_IDS = [
  'dr_morgan',
  'scout_alvarez',
  'viktor_kane',
  'sofia_mendes',
  'madame_pythia',
]

/** Capture the GET handler registered by registerVerifiabilityRoutes. */
function captureHandler(svc: AgentEventService) {
  let handler: (req: any, res: any) => void = () => {}
  const fakeApp = {
    get(path: string, fn: (req: any, res: any) => void) {
      if (path === '/api/public/verifiability') handler = fn
    },
  } as any
  registerVerifiabilityRoutes(fakeApp, svc)
  return handler
}

/** Invoke the handler and return the JSON body. */
function invoke(handler: (req: any, res: any) => void): VerifiabilityResponse {
  let body: any = null
  const res = { json: (b: any) => { body = b } }
  handler({}, res)
  return body
}

describe('GET /api/public/verifiability', () => {
  let svc: AgentEventService
  let handler: (req: any, res: any) => void

  beforeEach(() => {
    svc = new AgentEventService({ dataDir: null })
    handler = captureHandler(svc)
  })

  it('returns ok:true', () => {
    const body = invoke(handler)
    expect(body.ok).toBe(true)
  })

  it('includes the Walrus site object ID', () => {
    const body = invoke(handler)
    expect(body.walrusSiteObject).toBe(
      '0xa22ada9c09100eaca2571b64a2494f00a5393b012132aa74392bdcc6bd0a3272',
    )
  })

  it('includes frontend URL', () => {
    const body = invoke(handler)
    expect(body.frontendUrl).toBe('https://taken.wal.app')
  })

  it('includes MemWal relayer URL containing walrus', () => {
    const body = invoke(handler)
    expect(body.memwalRelayer).toContain('walrus')
  })

  it('declares the namespace pattern', () => {
    const body = invoke(handler)
    expect(body.memwalNamespacePattern).toBe('mwc-agent:{agentId}')
  })

  it('returns all 5 agents with correct namespace', () => {
    const body = invoke(handler)
    expect(body.agents).toHaveLength(5)
    for (const a of body.agents) {
      expect(AGENT_IDS).toContain(a.agentId)
      expect(a.memwalNamespace).toBe(`mwc-agent:${a.agentId}`)
      expect(a.counts.predictions).toBeGreaterThanOrEqual(0)
      expect(a.counts.outcomes).toBeGreaterThanOrEqual(0)
    }
  })

  it('reflects live event counts after adding a prediction', async () => {
    await svc.addPrediction({
      agentId: 'dr_morgan',
      matchId: 'test:m1',
      pick: 'Home',
      confidence: 0.7,
      reasoning: 'test verifiability',
      predictionId: 'p-test-1',
    })
    const body = invoke(handler)
    const morgan = body.agents.find((a) => a.agentId === 'dr_morgan')
    expect(morgan!.counts.predictions).toBe(1)
  })

  it('includes Walrus + Sui explorer arrays with HTTPS URLs', () => {
    const body = invoke(handler)
    expect(body.explorers.walrus.length).toBeGreaterThanOrEqual(1)
    expect(body.explorers.sui.length).toBeGreaterThanOrEqual(1)
    for (const e of [...body.explorers.walrus, ...body.explorers.sui]) {
      expect(e.name).toBeTruthy()
      expect(e.baseUrl).toMatch(/^https:\/\//)
    }
  })

  it('includes a non-empty howToVerify recipe', () => {
    const body = invoke(handler)
    expect(body.howToVerify.length).toBeGreaterThanOrEqual(3)
    for (const step of body.howToVerify) {
      expect(step.trim().length).toBeGreaterThan(0)
    }
  })

  it('never leaks secrets in the response', () => {
    const body = invoke(handler)
    const raw = JSON.stringify(body)
    expect(raw).not.toContain('MEMWAL_KEY')
    expect(raw).not.toContain('JWT_SECRET')
  })

  it('contains zero Cyrillic characters', () => {
    const body = invoke(handler)
    const raw = JSON.stringify(body)
    expect(raw).not.toMatch(/[\u0400-\u04FF]/)
  })
})
