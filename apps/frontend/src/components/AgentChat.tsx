/**
 * AgentChat | v1.0.0 | 2026-06-17
 * Purpose: In-modal LLM chat tab — pixel-styled, token-pure, session-held history.
 * T55: Memory-aware agent conversation surface. No Cyrillic, all colours via tokens.
 *
 * Architecture:
 * - History is session-only (held in React state, lost on modal close).
 * - Backend holds no history — we send the last 10 turns with each request.
 * - Topic filter + daily cap are server-side; we just show the response.
 */

import React, { useState, useRef, useEffect, useCallback, type FormEvent } from 'react'
import { chatWithAgent, type ChatTurn } from '@/lib/api'
import { palette, accents, text, fonts, borders, shadows, type as typo, agentColors } from '@/styles/tokens'

interface AgentChatProps {
  agentId: string
  agentName: string
}

interface ChatMessage extends ChatTurn {
  provider?: string
  deflected?: boolean
}

const MAX_INPUT_LENGTH = 1000
const MAX_DISPLAY_HISTORY = 20

export function AgentChat({ agentId, agentName }: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus input on mount.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const accentColor = agentColors[agentId] ?? accents.gold

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      const trimmed = input.trim()
      if (!trimmed || sending) return

      setInput('')
      setError(null)

      // Add user message immediately.
      const userMsg: ChatMessage = { role: 'user', content: trimmed }
      setMessages((prev) => [...prev, userMsg])
      setSending(true)

      try {
        // Build history for API (last 10 turns, excluding the current message).
        const apiHistory: ChatTurn[] = messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }))

        const res = await chatWithAgent(agentId, trimmed, apiHistory)

        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: res.text,
          provider: res.meta.provider,
          deflected: res.meta.deflected,
        }
        setMessages((prev) => [...prev, assistantMsg].slice(-MAX_DISPLAY_HISTORY))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to send message'
        setError(msg)
      } finally {
        setSending(false)
        inputRef.current?.focus()
      }
    },
    [input, sending, messages, agentId],
  )

  return (
    <div style={styles.container}>
      {/* Chat messages area */}
      <div ref={scrollRef} style={styles.messageArea} role="log" aria-label={`Chat with ${agentName}`}>
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            <div style={{ ...typo.body, fontFamily: fonts.body, color: text.muted }}>
              Ask {agentName} about football, predictions, or methodology.
            </div>
            <div style={{ ...typo.caption, fontFamily: fonts.body, color: text.faint, marginTop: 6 }}>
              Session-only — history resets when you close this modal.
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={msg.role === 'user' ? styles.userRow : styles.agentRow}>
            <div
              style={{
                ...styles.bubble,
                ...(msg.role === 'user' ? styles.userBubble : styles.agentBubble(accentColor)),
              }}
            >
              <div style={styles.bubbleLabel(msg.role === 'user' ? text.faint : accentColor)}>
                {msg.role === 'user' ? 'you' : agentName}
              </div>
              <div style={styles.bubbleText}>{msg.content}</div>
            </div>
          </div>
        ))}

        {sending && (
          <div style={styles.agentRow}>
            <div style={{ ...styles.bubble, ...styles.agentBubble(accentColor) }}>
              <div style={styles.bubbleLabel(accentColor)}>{agentName}</div>
              <div style={{ ...styles.bubbleText, color: text.muted }}>
                <TypingIndicator color={accentColor} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div style={styles.errorBanner}>
          <span style={{ ...typo.caption, fontFamily: fonts.body, color: accents.red }}>{error}</span>
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSubmit} style={styles.inputArea}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT_LENGTH))}
          placeholder="Type your message..."
          disabled={sending}
          maxLength={MAX_INPUT_LENGTH}
          aria-label="Chat message"
          style={styles.input}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          aria-label="Send message"
          style={{
            ...styles.sendBtn,
            opacity: !input.trim() || sending ? 0.4 : 1,
            cursor: !input.trim() || sending ? 'default' : 'pointer',
          }}
        >
          {sending ? '...' : '>'}
        </button>
      </form>
    </div>
  )
}

/** Pixel-style typing indicator: three blinking squares. */
function TypingIndicator({ color }: { color: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            background: color,
            animation: `pixelBlink 1.2s ${i * 0.2}s infinite step-start`,
          }}
        />
      ))}
      <style>{`
        @keyframes pixelBlink {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
      `}</style>
    </span>
  )
}

/* ── Styles (token-pure, inline CSSProperties) ──────────────────────── */

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    minHeight: 0,
  },

  messageArea: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '8px 4px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
    minHeight: 0,
  },

  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    textAlign: 'center' as const,
    padding: 16,
  },

  userRow: {
    display: 'flex',
    justifyContent: 'flex-end' as const,
  },

  agentRow: {
    display: 'flex',
    justifyContent: 'flex-start' as const,
  },

  bubble: {
    maxWidth: '80%',
    padding: '6px 10px',
    borderRadius: 0,
  },

  userBubble: {
    background: palette.wood700,
    border: borders.standard,
    boxShadow: shadows.hardSmall,
  },

  agentBubble: (accentColor: string) => ({
    background: palette.surface,
    border: `2px solid ${accentColor}40`,
    boxShadow: shadows.hardSmall,
  }),

  bubbleLabel: (color: string) => ({
    ...typo.caption,
    fontFamily: fonts.header,
    color,
    marginBottom: 2,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  }),

  bubbleText: {
    ...typo.body,
    fontFamily: fonts.body,
    color: text.primary,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },

  errorBanner: {
    padding: '4px 10px',
    background: `${accents.red}18`,
    borderTop: `1px solid ${accents.red}40`,
  },

  inputArea: {
    display: 'flex',
    gap: 4,
    padding: '8px 4px 4px',
    borderTop: borders.rule,
  },

  input: {
    flex: 1,
    background: palette.surface,
    border: borders.standard,
    color: text.primary,
    fontFamily: fonts.body,
    fontSize: typo.body.fontSize,
    lineHeight: typo.body.lineHeight,
    padding: '6px 10px',
    outline: 'none',
    borderRadius: 0,
  } as React.CSSProperties,

  sendBtn: {
    background: palette.wood500,
    border: borders.standard,
    color: text.primary,
    fontFamily: fonts.header,
    fontSize: typo.hdr.fontSize,
    padding: '6px 12px',
    borderRadius: 0,
    boxShadow: shadows.bevelInset,
    minWidth: 36,
    textAlign: 'center' as const,
  } as React.CSSProperties,
}
