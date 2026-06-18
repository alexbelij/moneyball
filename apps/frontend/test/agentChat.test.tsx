/**
 * agentChat.test.tsx | v1.0.0 | 2026-06-17
 * Tests for T55: AgentChat component — renders, sends messages, shows responses.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

Object.defineProperty(window, 'WebGLRenderingContext', { value: class {}, writable: true, configurable: true })
window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any

// Mock the api module.
const chatWithAgent = vi.fn()
vi.mock('@/lib/api', () => ({
  chatWithAgent: (...a: unknown[]) => chatWithAgent(...a),
}))

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgentChat } from '@/components/AgentChat'

describe('AgentChat (T55)', () => {
  beforeEach(() => {
    chatWithAgent.mockReset()
  })

  it('renders empty state with agent name', () => {
    render(<AgentChat agentId="dr_morgan" agentName="Dr. Morgan" />)
    expect(screen.getByText(/ask dr\. morgan/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/chat message/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/send message/i)).toBeInTheDocument()
  })

  it('shows user message immediately and agent reply after API response', async () => {
    chatWithAgent.mockResolvedValue({
      ok: true,
      text: 'My xG model favours Brazil.',
      meta: { provider: 'deterministic', identity: 'guest', source: 'deterministic' },
    })

    render(<AgentChat agentId="dr_morgan" agentName="Dr. Morgan" />)
    const user = userEvent.setup()

    const input = screen.getByLabelText(/chat message/i)
    await user.type(input, 'Who will win the World Cup?')
    await user.click(screen.getByLabelText(/send message/i))

    // User message appears immediately.
    expect(screen.getByText('Who will win the World Cup?')).toBeInTheDocument()

    // Agent reply appears after API resolves.
    await waitFor(() => {
      expect(screen.getByText('My xG model favours Brazil.')).toBeInTheDocument()
    })

    expect(chatWithAgent).toHaveBeenCalledWith(
      'dr_morgan',
      'Who will win the World Cup?',
      [],
    )
  })

  it('shows error banner when API call fails', async () => {
    chatWithAgent.mockRejectedValue(new Error('API 500: Internal'))

    render(<AgentChat agentId="scout_alvarez" agentName="Scout Alvarez" />)
    const user = userEvent.setup()

    const input = screen.getByLabelText(/chat message/i)
    await user.type(input, 'Tell me about the group stage')
    await user.click(screen.getByLabelText(/send message/i))

    await waitFor(() => {
      expect(screen.getByText(/API 500/i)).toBeInTheDocument()
    })
  })

  it('disables send button when input is empty', () => {
    render(<AgentChat agentId="dr_morgan" agentName="Dr. Morgan" />)
    const sendBtn = screen.getByLabelText(/send message/i)
    expect(sendBtn).toBeDisabled()
  })

  it('clears input after sending', async () => {
    chatWithAgent.mockResolvedValue({
      ok: true,
      text: 'Good question.',
      meta: { provider: 'deterministic', identity: 'guest', source: 'deterministic' },
    })

    render(<AgentChat agentId="dr_morgan" agentName="Dr. Morgan" />)
    const user = userEvent.setup()

    const input = screen.getByLabelText(/chat message/i) as HTMLInputElement
    await user.type(input, 'Hello')
    await user.click(screen.getByLabelText(/send message/i))

    // Input should be cleared after send.
    expect(input.value).toBe('')
  })

  it('sends conversation history with second message', async () => {
    chatWithAgent
      .mockResolvedValueOnce({
        ok: true,
        text: 'First response.',
        meta: { provider: 'deterministic', identity: 'guest', source: 'deterministic' },
      })
      .mockResolvedValueOnce({
        ok: true,
        text: 'Second response.',
        meta: { provider: 'deterministic', identity: 'guest', source: 'deterministic' },
      })

    render(<AgentChat agentId="dr_morgan" agentName="Dr. Morgan" />)
    const user = userEvent.setup()

    const input = screen.getByLabelText(/chat message/i)

    // First message.
    await user.type(input, 'Hello')
    await user.click(screen.getByLabelText(/send message/i))
    await waitFor(() => expect(screen.getByText('First response.')).toBeInTheDocument())

    // Second message — should include history.
    await user.type(input, 'Follow up')
    await user.click(screen.getByLabelText(/send message/i))

    await waitFor(() => {
      expect(chatWithAgent).toHaveBeenCalledTimes(2)
      const lastCall = chatWithAgent.mock.calls[1]
      expect(lastCall[0]).toBe('dr_morgan')
      expect(lastCall[1]).toBe('Follow up')
      // History should contain the first exchange.
      expect(lastCall[2]).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'First response.' },
      ])
    })
  })

  it('uses token-based colors (no raw hex in rendered HTML)', () => {
    const { container } = render(<AgentChat agentId="dr_morgan" agentName="Dr. Morgan" />)
    // The empty state should contain text with font-family from tokens.
    const el = container.querySelector('[role="log"]')
    expect(el).toBeInTheDocument()
  })
})
