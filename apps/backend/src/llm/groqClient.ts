/**
 * groqClient | v1.0.0 | 2026-06-17
 * Purpose: Groq LLM provider (OpenAI-compatible REST API).
 * T55: chat-design § 1 — primary provider in the chained client.
 *
 * Env: GROQ_API_KEY, GROQ_MODEL (default: llama-3.3-70b-versatile).
 * Timeout via AbortController; throws on non-2xx / timeout.
 */

import type { LlmClient, LlmRequest, LlmResult } from './types'

export interface GroqClientConfig {
  apiKey: string
  model: string
  timeoutMs: number
}

export class GroqClient implements LlmClient {
  private readonly config: GroqClientConfig

  constructor(config: GroqClientConfig) {
    this.config = config
  }

  async complete(req: LlmRequest): Promise<LlmResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs)

    try {
      const messages = [
        { role: 'system' as const, content: req.system },
        ...req.messages.map((m) => ({ role: m.role, content: m.content })),
      ]

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          max_tokens: req.maxTokens,
          temperature: req.temperature ?? 0.7,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`Groq ${res.status}: ${body.slice(0, 200)}`)
      }

      const data = (await res.json()) as {
        choices: Array<{ message: { content: string } }>
        usage?: { prompt_tokens?: number; completion_tokens?: number }
      }

      const text = data.choices?.[0]?.message?.content ?? ''

      return {
        text,
        provider: 'groq',
        usage: {
          inputTokens: data.usage?.prompt_tokens,
          outputTokens: data.usage?.completion_tokens,
        },
      }
    } finally {
      clearTimeout(timer)
    }
  }
}
