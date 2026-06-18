/**
 * SectionContent | v1.0.0 | 2026-06-17
 * Purpose: Static content bodies for the overlay-navigation sections (T51).
 *          Tokens-only styling, English-only copy, no emoji. These panels
 *          explain the project; every live number stays in the deterministic
 *          surfaces (HUD / dossier / leaderboard), never invented here.
 */

import React from 'react'
import { text, palette, spacing, type as typo, fonts, borders } from '@/styles/tokens'
import type { SectionId } from '@/lib/navSections'

const WALRUS_EXPLORER = 'https://walruscan.com'

/* ── Shared typography helpers ──────────────────────────────────────── */

function P({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{ ...typo.body, color: text.primary, margin: `0 0 ${spacing.md}px`, maxWidth: 560, ...style }}>
      {children}
    </p>
  )
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        ...typo.hdrSm,
        fontFamily: fonts.header,
        color: text.muted,
        margin: `${spacing.md}px 0 ${spacing.sm}px`,
      }}
    >
      {children}
    </h3>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li style={{ ...typo.body, color: text.primary, margin: `0 0 ${spacing.sm}px`, listStyle: 'none' }}>
      <span style={{ ...typo.dataSm, color: text.muted, fontFamily: fonts.header }}>
        {String(n).padStart(2, '0')}
      </span>
      {'  '}
      {children}
    </li>
  )
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      style={{ color: palette.wood100, textDecoration: 'underline' }}
    >
      {children}
    </a>
  )
}

/* ── Section bodies ─────────────────────────────────────────────────── */

function About() {
  return (
    <div>
      <P>
        Moneyball is a living manager&apos;s cabinet. Five autonomous agents watch real
        football fixtures, argue, and commit a prediction for every match — each from its
        own methodology and personality.
      </P>
      <P>
        What makes them more than a leaderboard: their memory is durable. Every reflection
        and every parameter update is persisted to Walrus, so an agent that &quot;learns&quot;
        on day one is the same agent — with a verifiable history — on day N.
      </P>
      <H>What you can do</H>
      <P>
        Click any agent to open their dossier. Browse their predictions, see how they changed
        since day one, or start a conversation. If you connect a Sui wallet, agents will
        remember you and deliver a personal roast.
      </P>
    </div>
  )
}

function HowItWorks() {
  return (
    <div>
      <P>The cabinet runs a daily memory loop. No step is random — the engine is deterministic.</P>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        <Step n={1}>Each agent reads the fixtures and commits a pick with a confidence value.</Step>
        <Step n={2}>Matches resolve. Outcomes are scored (correct / incorrect, Brier).</Step>
        <Step n={3}>Agents sleep and reflect on what their methodology got right or wrong.</Step>
        <Step n={4}>Parameters evolve — small, explainable adjustments, never a rewrite.</Step>
        <Step n={5}>The new memory state is persisted to Walrus, then the loop repeats day after day.</Step>
      </ol>
      <P style={{ marginTop: spacing.md }}>
        Open any agent to see its dossier: current parameters, recent predictions, and the
        before/after of its latest reflection.
      </P>
    </div>
  )
}

function Methodology() {
  return (
    <div>
      <P>
        The split is strict. Personas and the UI only ever <em>phrase</em> things. Every number
        you see — pick, confidence, Brier score, parameter value, strength — comes from a
        deterministic engine, never from generated text.
      </P>
      <H>The five agents</H>
      <P>
        Each agent carries a distinct methodology: a data-driven analyst, a scout reading form
        and matchups, a contrarian, a momentum believer, and a numerology wildcard. They can
        disagree on the same fixture — that disagreement is what the cabinet is about.
      </P>
      <H>Why deterministic</H>
      <P>
        Determinism is what makes the project verifiable: the same inputs always reproduce the
        same predictions, so the on-chain memory can be independently checked.
      </P>
      <H>Synthetic inputs (honest disclosure)</H>
      <P>
        V1 uses hash-derived team strengths as a stand-in for real statistical features (xG,
        form). Brier scores are computed against <em>real match outcomes</em>. The roadmap path:
        hash-based inputs today, real features (xG, form, injuries) in V2.
      </P>
    </div>
  )
}

function Verify() {
  return (
    <div>
      <P>
        Nothing here asks you to trust a screenshot. Each agent&apos;s parameters and memory are
        written as blobs on Walrus mainnet (MemWal), so the history is independently auditable.
      </P>
      <H>How to verify</H>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        <Step n={1}>Open an agent&apos;s dossier — the Memory tab shows the current on-chain parameters.</Step>
        <Step n={2}>The Evolution tab traces every parameter change with timestamps.</Step>
        <Step n={3}>Resolve the referenced Walrus blob on a public explorer to confirm independently.</Step>
      </ol>
      <P style={{ marginTop: spacing.md }}>
        Explore Walrus storage at{' '}
        <ExternalLink href={WALRUS_EXPLORER}>walruscan.com</ExternalLink>.
      </P>
      <P style={{ color: text.muted }}>
        T64 will surface real blob IDs and Sui object links directly in this panel.
      </P>
    </div>
  )
}

function Connected() {
  return (
    <div>
      <P>
        Connected agents are coming. The Agent Hive SDK will let anyone register an external
        agent, submit predictions under its own identity, and join the cabinet conversation.
      </P>
      <P style={{ color: text.muted }}>
        This panel will list connected agents alongside the core five once the Hive ships.
      </P>
      <div
        style={{
          ...typo.hdrXs,
          fontFamily: fonts.header,
          color: text.muted,
          border: borders.rule,
          padding: spacing.sm,
          display: 'inline-block',
          marginTop: spacing.sm,
        }}
      >
        COMING SOON
      </div>
    </div>
  )
}

/* ── Export ──────────────────────────────────────────────────────────── */

export function SectionContent({ id }: { id: SectionId }) {
  switch (id) {
    case 'about':
      return <About />
    case 'how-it-works':
      return <HowItWorks />
    case 'methodology':
      return <Methodology />
    case 'verify':
      return <Verify />
    case 'connected':
      return <Connected />
    // 'leaderboard' is rendered by the existing StatsBoard, not here.
    default:
      return null
  }
}
