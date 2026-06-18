/**
 * agentRegistry.test | v2.0.0 | 2026-06-18
 * Purpose: Verify escapeHtml utility and AgentRegistry exports (T52/T53/T54).
 */

import { describe, expect, it } from 'vitest'
import { AgentRegistry, escapeHtml } from '../src/agents/agentRegistry'

describe('escapeHtml', () => {
  it('escapes HTML entities', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    )
  })

  it('escapes ampersands and single quotes', () => {
    expect(escapeHtml("a & b's")).toBe('a &amp; b&#39;s')
  })
})

describe('AgentRegistry class', () => {
  it('is exported and is a constructor', () => {
    expect(AgentRegistry).toBeDefined()
    expect(typeof AgentRegistry).toBe('function')
  })
})
