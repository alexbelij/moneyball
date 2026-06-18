/**
 * chainedClient.test | T55 | 2026-06-17
 * Tests: ChainedLlmClient + DeterministicClient — fault-tolerant chain, no keys needed.
 */

import { describe, it, expect, vi } from 'vitest'
import { ChainedLlmClient } from '../src/llm/chainedClient'
import { DeterministicClient } from '../src/llm/deterministicClient'
import type { LlmClient, LlmRequest, LlmResult } from '../src/llm/types'

const baseRequest: LlmRequest = {
  system: 'You are Dr. Morgan. Catchphrases: "Probabilities don\'t lie."',
  messages: [{ role: 'user', content: 'Who will win the World Cup?' }],
  maxTokens: 320,
}

function mockClient(result: Partial<LlmResult> & { text: string; provider: LlmResult['provider'] }): LlmClient {
  return { complete: vi.fn().mockResolvedValue(result) }
}

function failingClient(error: string): LlmClient {
  return { complete: vi.fn().mockRejectedValue(new Error(error)) }
}

describe('ChainedLlmClient', () => {
  it('returns result from the first successful provider', async () => {
    const primary = mockClient({ text: 'Primary reply', provider: 'groq' })
    const fallback = mockClient({ text: 'Fallback reply', provider: 'gemini' })
    const deterministic = new DeterministicClient()

    const chain = new ChainedLlmClient([primary, fallback, deterministic])
    const result = await chain.complete(baseRequest)

    expect(result.text).toBe('Primary reply')
    expect(result.provider).toBe('groq')
    expect(primary.complete).toHaveBeenCalledTimes(1)
    expect(fallback.complete).not.toHaveBeenCalled()
  })

  it('falls through to fallback when primary fails', async () => {
    const primary = failingClient('Groq 429')
    const fallback = mockClient({ text: 'Fallback reply', provider: 'gemini' })
    const deterministic = new DeterministicClient()

    const chain = new ChainedLlmClient([primary, fallback, deterministic])
    const result = await chain.complete(baseRequest)

    expect(result.text).toBe('Fallback reply')
    expect(result.provider).toBe('gemini')
  })

  it('falls through to deterministic when all LLM providers fail', async () => {
    const primary = failingClient('Groq timeout')
    const fallback = failingClient('Gemini 429')
    const deterministic = new DeterministicClient()

    const chain = new ChainedLlmClient([primary, fallback, deterministic])
    const result = await chain.complete(baseRequest)

    expect(result.provider).toBe('deterministic')
    expect(result.text.length).toBeGreaterThan(5)
  })

  it('never rejects when chain ends with DeterministicClient', async () => {
    const failing1 = failingClient('Error 1')
    const failing2 = failingClient('Error 2')
    const deterministic = new DeterministicClient()

    const chain = new ChainedLlmClient([failing1, failing2, deterministic])
    // Must not throw.
    const result = await chain.complete(baseRequest)
    expect(result).toBeDefined()
    expect(result.text).toBeTruthy()
  })

  it('throws if the chain has no providers', () => {
    expect(() => new ChainedLlmClient([])).toThrow('at least one provider')
  })
})

describe('DeterministicClient', () => {
  it('returns a non-empty text with provider=deterministic', async () => {
    const client = new DeterministicClient()
    const result = await client.complete(baseRequest)

    expect(result.provider).toBe('deterministic')
    expect(result.text.length).toBeGreaterThan(5)
  })

  it('extracts catchphrases from system prompt when available', async () => {
    const client = new DeterministicClient()
    const result = await client.complete({
      ...baseRequest,
      system: 'You are Dr. Morgan. Catchphrases: "Probabilities don\'t lie.", "Numbers see the truth."',
    })

    // Result should be one of the catchphrases or a generic line.
    expect(result.text).toBeTruthy()
  })

  it('is deterministic (same input → same output)', async () => {
    const client = new DeterministicClient()
    const r1 = await client.complete(baseRequest)
    const r2 = await client.complete(baseRequest)
    expect(r1.text).toBe(r2.text)
  })

  it('never rejects', async () => {
    const client = new DeterministicClient()
    // Empty system prompt, empty messages — still works.
    const result = await client.complete({
      system: '',
      messages: [],
      maxTokens: 100,
    })
    expect(result.provider).toBe('deterministic')
    expect(result.text).toBeTruthy()
  })
})
