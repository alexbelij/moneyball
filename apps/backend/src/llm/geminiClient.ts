/**
 * geminiClient | v1.0.0 | 2026-06-17
 * Purpose: Google Gemini LLM provider (REST v1beta generateContent).
 * T55: chat-design § 1 — fallback provider in the chained client.
 *
 * Env: GEMINI_API_KEY, GEMINI_MODEL (default: gemini-flash-latest).
 * MUST set thinkingConfig.thinkingBudget = 0 (thinking model constraint).
 * Timeout via AbortController; throws on non-2xx / timeout.
 */

import type { LlmClient, LlmRequest, LlmResult } from './types'

export interface GeminiClientConfig {
  apiKey: string
  model: string
  timeoutMs: number
}

export class GeminiClient implements LlmClient {
  private readonly config: GeminiClientConfig

  constructor(config: GeminiClientConfig) {
    this.config = config
  }

  async complete(req: LlmRequest): Promise<LlmResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs)

    try {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`

      // Convert chat turns to Gemini format.
      // System instruction is separate; user/assistant become contents.
      const contents = req.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))

      const body = {
        systemInstruction: { parts: [{ text: req.system }] },
        contents,
        generationConfig: {
          maxOutputTokens: req.maxTokens,
          temperature: req.temperature ?? 0.7,
          // MUST disable thinking for gemini-flash (returns 429 otherwise).
          thinkingConfig: { thinkingBudget: 0 },
        },
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        throw new Error(`Gemini ${res.status}: ${errBody.slice(0, 200)}`)
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

      return {
        text,
        provider: 'gemini',
        usage: {
          inputTokens: data.usageMetadata?.promptTokenCount,
          outputTokens: data.usageMetadata?.candidatesTokenCount,
        },
      }
    } finally {
      clearTimeout(timer)
    }
  }
}
