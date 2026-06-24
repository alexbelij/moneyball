/**
 * RetroTicket | v1.0.0 | 2026-06-21 | TASK 4.5
 * Purpose: 8-bit retro ticket sharing generator. Generates a pixel-art styled
 * shareable ticket for predictions. Copies ASCII-art ticket to clipboard for
 * viral sharing on Twitter/Telegram. Also renders a visual 16-bit-styled ticket
 * in the UI.
 */

import React from 'react'
import { palette, accents, text, fonts, borders, shadows, type as typo, spacing } from '@/styles/tokens'
import { walrusBlobUrl } from '@/lib/explorer'

export interface RetroTicketData {
  /** e.g. "Argentina vs France" */
  matchTitle: string
  /** e.g. "Argentina" */
  pick: string
  /** 0-1 confidence */
  confidence: number
  /** Agent name */
  agentName: string
  /** ISO date */
  date: string
  /** Walrus blob id (optional) */
  blobId?: string
  /** correct / incorrect / pending */
  result?: 'correct' | 'incorrect' | 'pending'
}

/**
 * Build ASCII-art ticket text for clipboard sharing.
 */
function buildAsciiTicket(data: RetroTicketData): string {
  const W = 45
  const hr = '+' + '-'.repeat(W - 2) + '+'
  const pad = (s: string) => {
    const trimmed = s.slice(0, W - 4)
    return '| ' + trimmed + ' '.repeat(W - 4 - trimmed.length) + ' |'
  }
  const empty = '|' + ' '.repeat(W - 2) + '|'
  const dots = '|' + ' ·'.repeat(Math.floor((W - 2) / 2)) + (W % 2 === 0 ? '' : ' ') + '|'

  const conf = Math.round(data.confidence * 100)
  const dateStr = new Date(data.date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
  const resultStr = data.result === 'correct' ? '[OK] CORRECT'
    : data.result === 'incorrect' ? '[X] INCORRECT'
    : '[..] PENDING'
  const blobStr = data.blobId ? `blob:${data.blobId.slice(0, 12)}...` : 'awaiting write'
  const verifyUrl = data.blobId ? walrusBlobUrl(data.blobId) : ''

  const lines = [
    hr,
    pad('*** MONEYBALL CABINET TICKET ***'),
    pad('Decentralized Memory Verified'),
    dots,
    pad(`Match: ${data.matchTitle}`),
    pad(`Pick:  ${data.pick} (${conf}%)`),
    pad(`Agent: ${data.agentName}`),
    pad(`Date:  ${dateStr}`),
    pad(`Result: ${resultStr}`),
    dots,
    pad(`Walrus: ${blobStr}`),
  ]
  if (verifyUrl) {
    lines.push(pad(`Verify: ${verifyUrl.slice(0, W - 6)}`))
  }
  lines.push(hr)
  lines.push('')
  lines.push('moneyball.wal.app | Predict the World Cup with AI')

  return lines.join('\n')
}

/**
 * Share button — copies ASCII ticket to clipboard.
 */
export function ShareTicketButton({ data }: { data: RetroTicketData }) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = React.useCallback(async () => {
    const ticket = buildAsciiTicket(data)
    try {
      await navigator.clipboard.writeText(ticket)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const ta = document.createElement('textarea')
      ta.value = ticket
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [data])

  return (
    <button
      onClick={handleCopy}
      aria-label="Copy retro ticket to clipboard"
      title="Share prediction ticket"
      style={{
        background: copied ? accents.green : palette.wood700,
        color: copied ? palette.wood900 : accents.gold,
        border: borders.standard,
        padding: '2px 6px',
        fontFamily: fonts.header,
        ...typo.caption,
        cursor: 'pointer',
        transition: 'background 0.15s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <span style={{ fontSize: 14 }}>{copied ? '>' : '+'}</span>
      <span>{copied ? 'COPIED!' : 'SHARE'}</span>
    </button>
  )
}

/**
 * Visual retro ticket — 16-bit pixel-art styled card.
 */
export function RetroTicketCard({ data }: { data: RetroTicketData }) {
  const conf = Math.round(data.confidence * 100)
  const dateStr = new Date(data.date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
  const resultColor = data.result === 'correct' ? accents.green
    : data.result === 'incorrect' ? accents.red
    : text.muted

  return (
    <div style={{
      border: `2px dashed ${accents.gold}`,
      background: palette.wood900,
      padding: spacing.sm,
      maxWidth: 340,
      fontFamily: fonts.body,
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{
        ...typo.hdrSm,
        fontFamily: fonts.header,
        color: accents.gold,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        borderBottom: `2px solid ${palette.wood500}`,
        paddingBottom: 6,
        marginBottom: 8,
      }}>
        * MONEYBALL TICKET *
      </div>

      {/* Match info */}
      <div style={{ ...typo.data, color: text.primary, marginBottom: 4 }}>
        {data.matchTitle}
      </div>

      {/* Pick + confidence */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ ...typo.data, color: accents.gold, fontWeight: 400 }}>
          Pick: {data.pick}
        </span>
        <span style={{ ...typo.caption, color: text.muted }}>
          {conf}% conf
        </span>
      </div>

      {/* Agent + date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ ...typo.caption, color: text.dim }}>
          Agent: {data.agentName}
        </span>
        <span style={{ ...typo.caption, color: text.faint }}>
          {dateStr}
        </span>
      </div>

      {/* Result */}
      <div style={{
        ...typo.caption,
        color: resultColor,
        fontFamily: fonts.header,
        textTransform: 'uppercase',
        marginBottom: 6,
      }}>
        {data.result === 'correct' ? '[OK] CORRECT' : data.result === 'incorrect' ? '[X] INCORRECT' : '[..] PENDING'}
      </div>

      {/* Walrus proof */}
      {data.blobId && (
        <div style={{
          borderTop: `2px solid ${palette.wood500}`,
          paddingTop: 6,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <a
            href={walrusBlobUrl(data.blobId)}
            target="_blank"
            rel="noreferrer noopener"
            style={{ ...typo.caption, color: text.faint, textDecoration: 'none' }}
          >
            <span style={{
              width: 6, height: 6,
              background: accents.gold,
              display: 'inline-block',
              marginRight: 4,
            }} />
            blob:{data.blobId.slice(0, 8)}…
          </a>
          <span style={{ ...typo.caption, color: text.faint, fontStyle: 'italic' }}>
            Memory Verified
          </span>
        </div>
      )}

      {/* Share button */}
      <div style={{ marginTop: 8, textAlign: 'right' }}>
        <ShareTicketButton data={data} />
      </div>

      {/* Perforated edge (decorative, pixel dashes) */}
      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: -1,
        height: 2,
        borderBottom: `2px dashed ${accents.gold}`,
      }} />
    </div>
  )
}
