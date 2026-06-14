/**
 * crashGuard.test | v1.0.0 | 2026-06-14
 * T40a: Verify that MemWal recall() rejections produce graceful responses,
 * never unhandled rejections / process crashes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { asyncHandler } from '../src/http/asyncHandler'
import { AgentEventService } from '../src/agents/agentEventService'

// ── asyncHandler unit tests ────────────────────────────────────────────
describe('asyncHandler', () => {
  it('returns 500 JSON when async handler throws', async () => {
    const mockRes: any = {
      headersSent: false,
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    }
    const handler = asyncHandler(async () => {
      throw new Error('MemWal 429 rate limit')
    })

    await new Promise<void>((resolve) => {
      mockRes.json.mockImplementation(() => { resolve() })
      handler({} as any, mockRes, vi.fn())
    })

    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({ ok: false, error: 'INTERNAL' })
  })

  it('does not call status(500) if headers already sent', async () => {
    const mockRes: any = {
      headersSent: true,
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    }
    const handler = asyncHandler(async () => {
      throw new Error('MemWal 429')
    })

    // Give it a moment to run
    await new Promise<void>((resolve) => {
      handler({} as any, mockRes, vi.fn())
      setTimeout(resolve, 50)
    })

    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it('passes through normal responses', async () => {
    const mockRes: any = {
      headersSent: false,
      json: vi.fn(),
    }
    const handler = asyncHandler(async (_req, res) => {
      res.json({ ok: true, data: 'hello' })
    })

    await new Promise<void>((resolve) => {
      mockRes.json.mockImplementation(() => { resolve() })
      handler({} as any, mockRes, vi.fn())
    })

    expect(mockRes.json).toHaveBeenCalledWith({ ok: true, data: 'hello' })
  })
})

// ── AgentEventService graceful degradation ─────────────────────────────
describe('AgentEventService graceful degradation', () => {
  let svc: AgentEventService

  beforeEach(() => {
    svc = new AgentEventService()
  })

  it('listPredictions returns [] when no events added (T40b: index-based)', async () => {
    // T40b: reads come from in-memory index, not from recall().
    // A fresh svc with no add* calls returns [].
    const result = await svc.listPredictions('dr_morgan')
    expect(result).toEqual([])
  })

  it('listEvolution returns [] when recall rejects', async () => {
    const mockClient = {
      recall: vi.fn().mockRejectedValue(new Error('MemWal timeout')),
      remember: vi.fn(),
      waitForRememberJob: vi.fn(),
    }
    vi.spyOn(svc as any, 'getClient').mockReturnValue(mockClient)
    Object.defineProperty(svc, 'enabled', { value: true })

    const result = await svc.listEvolution('scout_alvarez')
    expect(result).toEqual([])
  })

  it('listOutcomes returns [] when recall rejects', async () => {
    const mockClient = {
      recall: vi.fn().mockRejectedValue(new Error('MemWal relayer down')),
      remember: vi.fn(),
      waitForRememberJob: vi.fn(),
    }
    vi.spyOn(svc as any, 'getClient').mockReturnValue(mockClient)
    Object.defineProperty(svc, 'enabled', { value: true })

    const result = await svc.listOutcomes('viktor_kane')
    expect(result).toEqual([])
  })

  it('listPredictions in non-MemWal mode returns local events (no crash)', async () => {
    // enabled = false by default (no MEMWAL_KEY), uses localLog
    const result = await svc.listPredictions('dr_morgan')
    expect(result).toEqual([])
  })

  it('listEvolution returns valid events via write-through index (T40b)', async () => {
    // T40b: reads come from the in-memory index, not from recall()
    await svc.addEvolution({
      agentId: 'dr_morgan',
      summary: 'Adjusted calibration after poor Brier score',
      parameterDiff: { confidenceBias: -0.05 },
    })

    const result = await svc.listEvolution('dr_morgan')
    expect(result.length).toBe(1)
    expect(result[0].summary).toBe('Adjusted calibration after poor Brier score')
    expect(result[0].parameterDiff).toEqual({ confidenceBias: -0.05 })
  })
})
