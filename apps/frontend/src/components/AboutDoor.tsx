/**
 * AboutDoor | v1.0.0 | 2026-06-18
 * Purpose: "About / Credits" modal opened from door click.
 * Shows project description, team, tech stack, hackathon context, and links.
 * Purely static content — no API calls needed.
 *
 * Token-only styles. WAI-ARIA dialog + focus trap.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { PixelIcon } from '@/components/icons/PixelIcon'
import { PixelButton } from '@/components/ui'
import { GameEventBus } from '@/events/GameEventBus'
import { useFocusTrap } from '@/lib/a11y/useFocusTrap'
import {
  palette, accents, text, fonts, borders, shadows, zIndex,
  type as typo, agentColors, spacing, overlay,
} from '@/styles/tokens'

/* ═══════════════════════════════════════════════════════════════════════
 * CONSTANTS
 * ═══════════════════════════════════════════════════════════════════════ */

const MODAL_TITLE_ID = 'about-door-title'

const AGENTS = [
  { id: 'dr_morgan', name: 'Dr. Morgan', role: 'Statistician', emoji: 'dr_morgan' },
  { id: 'scout_alvarez', name: 'Scout Alvarez', role: 'Traditional Scout', emoji: 'scout_alvarez' },
  { id: 'viktor_kane', name: 'Viktor Kane', role: 'Contrarian', emoji: 'viktor_kane' },
  { id: 'sofia_mendes', name: 'Sofia Mendes', role: 'Market Analyst', emoji: 'sofia_mendes' },
  { id: 'madame_pythia', name: 'Madame Pythia', role: 'Mystic Analyst', emoji: 'madame_pythia' },
]

const TECH_STACK = [
  { label: 'Frontend', value: 'React + Phaser 3 (16-bit pixel art)' },
  { label: 'Backend', value: 'Node.js / Express / Socket.IO' },
  { label: 'Memory', value: 'Walrus Memory (MemWal) on Sui mainnet' },
  { label: 'Storage', value: 'Walrus decentralised blob store' },
  { label: 'Encryption', value: 'SEAL threshold encryption' },
  { label: 'Auth', value: 'Sui wallet (zkLogin) + guest mode' },
]

const LINKS = [
  { label: 'GitHub', url: 'https://github.com/anna-stolbovskaja/moneyball', icon: '□' },
  { label: 'Live App', url: 'https://taken.wal.app', icon: 'link' },
  { label: 'Walrus Memory', url: 'https://memory.walrus.xyz', icon: 'walrus' },
  { label: 'Walrus Session 4', url: 'https://www.deepsurge.xyz/hackathons/cbe3390c-88c1-48c6-a86d-5c1edb4b6d17', icon: 'hackathon' },
]

/* ═══════════════════════════════════════════════════════════════════════
 * MAIN COMPONENT
 * ═══════════════════════════════════════════════════════════════════════ */

export function AboutDoor() {
  const [open, setOpen] = useState(false)

  const trapRef = useFocusTrap<HTMLDivElement>({ onClose: () => setOpen(false), active: open })

  /* ── Open on door click ────────────────────────────────────────── */
  useEffect(() => {
    const handler = ({ propId }: { propId: string }) => {
      if (propId === 'door') setOpen(true)
    }
    GameEventBus.on('prop:click', handler)
    return () => { GameEventBus.off('prop:click', handler) }
  }, [])

  /* ── Pause scene while open ────────────────────────────────────── */
  useEffect(() => {
    if (!open) return
    GameEventBus.emit('scene:pause', undefined)
    return () => { GameEventBus.emit('scene:resume', undefined) }
  }, [open])

  const close = useCallback(() => setOpen(false), [])

  if (!open) return null

  return (
    <div
      style={S.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
      role="presentation"
    >
      <div
        ref={trapRef}
        style={S.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={MODAL_TITLE_ID}
      >
        {/* Header */}
        <div style={S.header}>
          <h2 id={MODAL_TITLE_ID} style={S.title}>▸ MONEYBALL</h2>
          <PixelButton size="small" onClick={close} aria-label="Close about">✕</PixelButton>
        </div>

        {/* Content */}
        <div style={S.content}>
          {/* Description */}
          <div style={S.section}>
            <p style={S.description}>
              <strong style={{ color: accents.gold }}>Moneyball</strong> is a scouting room
              where five AI agents with distinct personalities predict FIFA World Cup 2026
              match outcomes. Each agent uses its own methodology, learns from results through
              a self-learning loop (sleep → reflect → evolve), and records every decision
              permanently on the Walrus blockchain.
            </p>
            <p style={S.description}>
              Disagree with an agent? Tell them. They will roast you back.
            </p>
          </div>

          {/* Agents */}
          <div style={S.section}>
            <h3 style={S.sectionTitle}>The scouting team</h3>
            <div style={S.agentGrid}>
              {AGENTS.map((a) => (
                <div
                  key={a.id}
                  style={{
                    ...S.agentCard,
                    borderLeft: `3px solid ${agentColors[a.id] ?? accents.gold}`,
                  }}
                >
                  <span style={S.agentEmoji}>{a.emoji}</span>
                  <div>
                    <div style={S.agentName}>{a.name}</div>
                    <div style={S.agentRole}>{a.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tech stack */}
          <div style={S.section}>
            <h3 style={S.sectionTitle}>Tech stack</h3>
            <div style={S.techGrid}>
              {TECH_STACK.map((t) => (
                <div key={t.label} style={S.techRow}>
                  <span style={S.techLabel}>{t.label}</span>
                  <span style={S.techValue}>{t.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hackathon context */}
          <div style={S.section}>
            <h3 style={S.sectionTitle}>Hackathon</h3>
            <p style={S.description}>
              Built for the <strong style={{ color: accents.gold }}>Walrus Session 4</strong> hackathon.
              Deadline: June 24, 2026. The challenge: build an application that leverages
              Walrus Memory for persistent, verifiable AI agent state.
            </p>
          </div>

          {/* Links */}
          <div style={S.section}>
            <h3 style={S.sectionTitle}>Links</h3>
            <div style={S.linksRow}>
              {LINKS.map((l) => (
                <a
                  key={l.label}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={S.linkCard}
                >
                  <span style={S.linkIcon}>{l.icon}</span>
                  <span style={S.linkLabel}>{l.label}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={S.footer}>
            Made with{' '}
            <svg width="14" height="14" viewBox="0 0 16 16" fill={accents.red} style={{ verticalAlign: 'middle', margin: '0 2px' }}>
              <path d="M8 14s-5-3.5-5-7.5C3 4 5 2 8 4c3-2 5 0 5 2.5S8 14 8 14z" />
            </svg>
            {' '}in Minsk, 2026
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
 * STYLES (token-only)
 * ═══════════════════════════════════════════════════════════════════════ */

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: zIndex.modal,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: overlay,
  },
  panel: {
    position: 'relative',
    width: 'min(90vw, 660px)',
    maxHeight: '86vh',
    overflowY: 'auto',
    background: palette.wood900,
    border: borders.standard,
    boxShadow: shadows.hard,
    padding: spacing.md,
    color: text.primary,
    fontFamily: fonts.body,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky' as const, top: -spacing.md, marginBottom: spacing.md, marginLeft: -spacing.md, marginRight: -spacing.md, paddingLeft: spacing.md, paddingRight: spacing.md, paddingTop: spacing.sm, background: palette.wood900, zIndex: 1,
    paddingBottom: spacing.sm,
    borderBottom: borders.standard,
  },
  title: {
    fontFamily: fonts.header,
    ...typo.hdr,
    color: accents.gold,
    margin: 0,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.header,
    ...typo.hdrSm,
    color: accents.gold,
    margin: 0,
  },
  description: {
    fontFamily: fonts.body,
    ...typo.body,
    color: text.dim,
    margin: 0,
  },
  agentGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  agentCard: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: `6px ${spacing.sm}px`,
    background: palette.wood700,
    border: borders.rule,
  },
  agentEmoji: {
    ...typo.hdrLg,
    flexShrink: 0,
  },
  agentName: {
    fontFamily: fonts.header,
    ...typo.hdrXs,
    color: text.primary,
  },
  agentRole: {
    fontFamily: fonts.body,
    ...typo.caption,
    color: text.muted,
  },
  techGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  techRow: {
    display: 'flex',
    gap: spacing.sm,
    padding: `4px ${spacing.sm}px`,
    background: palette.wood700,
    border: borders.rule,
  },
  techLabel: {
    fontFamily: fonts.header,
    ...typo.hdrXs,
    color: text.muted,
    minWidth: 90,
    flexShrink: 0,
  },
  techValue: {
    fontFamily: fonts.body,
    ...typo.dataSm,
    color: text.primary,
  },
  linksRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  linkCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: `6px ${spacing.md}px`,
    background: palette.wood700,
    border: borders.standard,
    textDecoration: 'none',
    color: text.primary,
    fontFamily: fonts.body,
    ...typo.data,
    cursor: 'pointer',
    transition: 'border-color 120ms',
  },
  linkIcon: {
    ...typo.body,
  },
  linkLabel: {
    fontFamily: fonts.body,
    ...typo.dataSm,
    color: accents.gold,
  },
  footer: {
    fontFamily: fonts.body,
    ...typo.caption,
    color: text.faint,
    textAlign: 'center',
    padding: `${spacing.sm}px`,
    borderTop: borders.rule,
    marginTop: spacing.sm,
  },
}
