/**
 * VerifyPanel | v1.0.0 | 2026-06-18
 * Purpose: T64 verifiability surface -- shows on-chain identifiers, explorer
 *          links, per-agent MemWal namespaces, and a step-by-step recipe for
 *          independent verification. Token-pure, zero Cyrillic.
 */

import React, { useEffect, useState, useCallback } from 'react'
import { text, palette, spacing, type as typo, fonts, borders, accents } from '@/styles/tokens'
import { getVerifiability, type VerifiabilityData, type AgentVerifiability } from '@/lib/api'

const SUI_OBJECT_EXPLORER = 'https://suivision.xyz/object'

const FEEDBACK_ISSUES = [
  {
    title: 'MemWal SDK: no enumeration API limits auditability',
    url: 'https://github.com/anna-stolbovskaja/moneyball/blob/main/docs/feedback/001-memwal-enumeration-api.md',
    description:
      'Recall is semantic top-K only. Without a deterministic list/scan API, a consumer cannot prove completeness of their on-chain history.',
  },
  {
    title: 'Walrus site-builder: expose blob manifest for content verification',
    url: 'https://github.com/anna-stolbovskaja/moneyball/blob/main/docs/feedback/002-walrus-sites-blob-manifest.md',
    description:
      'After a site update, the only proof of what was published is the site object. A manifest mapping paths to blob IDs would enable content-level verification.',
  },
  {
    title: 'MemWal: surface blob_id for provenance linking',
    url: 'https://github.com/anna-stolbovskaja/moneyball/blob/main/docs/feedback/003-memwal-blobid-provenance.md',
    description:
      'Fire-and-forget writes lose the blob_id. Webhook callbacks or idempotency-key lookups would let apps link UI entries to specific Walrus blobs for audit.',
  },
] as const

/* ---- Style helpers -------------------------------------------------- */

const linkStyle: React.CSSProperties = {
  color: palette.wood100,
  textDecoration: 'underline',
  cursor: 'pointer',
}

const monoStyle: React.CSSProperties = {
  fontFamily: fonts.body,
  ...typo.dataSm,
  color: text.dim,
  wordBreak: 'break-all' as const,
  userSelect: 'all' as const,
}

const cardStyle: React.CSSProperties = {
  background: palette.surface,
  border: borders.standard,
  padding: spacing.md,
  marginBottom: spacing.md,
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ ...typo.hdrSm, fontFamily: fonts.header, color: text.muted, margin: `${spacing.lg}px 0 ${spacing.sm}px` }}>
      {children}
    </h3>
  )
}

function P({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{ ...typo.body, fontFamily: fonts.body, color: text.primary, margin: `0 0 ${spacing.sm}px`, maxWidth: 640, ...style }}>
      {children}
    </p>
  )
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer noopener" style={linkStyle}>{children}</a>
}

function CopyId({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard may be unavailable */ }
  }, [value])

  return (
    <div style={{ marginBottom: spacing.sm }}>
      <div style={{ ...typo.dataSm, fontFamily: fonts.header, color: text.muted, marginBottom: 2 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        <code style={monoStyle}>{value}</code>
        <button
          type="button"
          onClick={handleCopy}
          style={{ ...typo.dataSm, fontFamily: fonts.body, background: 'transparent', border: borders.rule, color: copied ? accents.green : text.muted, padding: `2px ${spacing.sm}px`, cursor: 'pointer', whiteSpace: 'nowrap' }}
          aria-label={`Copy ${label}`}
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
    </div>
  )
}

function AgentRow({ agent }: { agent: AgentVerifiability }) {
  return (
    <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm }}>
      <div>
        <div style={{ ...typo.dataSm, fontFamily: fonts.header, color: text.muted }}>{agent.agentId}</div>
        <code style={{ ...monoStyle, fontSize: 13 }}>{agent.memwalNamespace}</code>
      </div>
      <div style={{ display: 'flex', gap: spacing.md, flexWrap: 'wrap' }}>
        <Stat label="predictions" value={agent.counts.predictions} />
        <Stat label="outcomes" value={agent.counts.outcomes} />
        <Stat label="evolutions" value={agent.counts.substantiveEvolutions} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ ...typo.data, fontFamily: fonts.body, color: text.primary }}>{value}</div>
      <div style={{ ...typo.caption, fontFamily: fonts.body, color: text.faint }}>{label}</div>
    </div>
  )
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {steps.map((step, i) => (
        <li key={i} style={{ ...typo.body, fontFamily: fonts.body, color: text.primary, margin: `0 0 ${spacing.sm}px`, display: 'flex', gap: spacing.sm }}>
          <span style={{ ...typo.dataSm, fontFamily: fonts.header, color: text.muted, flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  )
}

function FeedbackIssue({ title, url, description }: (typeof FEEDBACK_ISSUES)[number]) {
  return (
    <div style={{ ...cardStyle, paddingBottom: spacing.sm }}>
      <div style={{ ...typo.dataSm, fontFamily: fonts.header, color: palette.wood100, marginBottom: 4 }}>
        <ExternalLink href={url}>{title}</ExternalLink>
      </div>
      <div style={{ ...typo.dataSm, fontFamily: fonts.body, color: text.dim }}>{description}</div>
    </div>
  )
}

/* ---- Main component ------------------------------------------------- */

export function VerifyPanel() {
  const [data, setData] = useState<VerifiabilityData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getVerifiability()
      .then((res) => { if (!cancelled) setData(res) })
      .catch((err) => { if (!cancelled) setError(String(err?.message ?? 'Failed to load verifiability data')) })
    return () => { cancelled = true }
  }, [])

  if (error) {
    return (
      <div style={{ padding: spacing.md }}>
        <P style={{ color: accents.red }}>Could not load verifiability data: {error}</P>
        <P>The backend may be waking up (Render free tier). Refresh in 30 seconds.</P>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ padding: spacing.md }}>
        <P style={{ color: text.muted }}>Loading verification data...</P>
      </div>
    )
  }

  return (
    <div>
      <P>
        Nothing here asks you to trust a screenshot. Every agent memory write
        lands on Walrus mainnet via MemWal (Walrus Memory SDK). The identifiers
        below let you check independently.
      </P>

      <SectionHeading>On-chain identifiers</SectionHeading>
      <CopyId label="Walrus site object" value={data.walrusSiteObject} />
      <div style={{ marginBottom: spacing.sm }}>
        <ExternalLink href={`${SUI_OBJECT_EXPLORER}/${data.walrusSiteObject}`}>View on Suivision</ExternalLink>
        {' | '}
        <ExternalLink href="https://walruscan.com">WalrusScan explorer</ExternalLink>
      </div>
      <CopyId label="MemWal account ID" value={data.memwalAccountId} />
      <CopyId label="MemWal relayer" value={data.memwalRelayer} />
      <div style={{ marginBottom: spacing.md }}>
        <div style={{ ...typo.dataSm, fontFamily: fonts.header, color: text.muted, marginBottom: 2 }}>Namespace pattern</div>
        <code style={monoStyle}>{data.memwalNamespacePattern}</code>
      </div>

      <SectionHeading>How to verify</SectionHeading>
      <StepList steps={data.howToVerify} />

      <SectionHeading>Per-agent verification</SectionHeading>
      <P style={{ color: text.dim, marginBottom: spacing.md }}>
        Live event counts from the backend read-model. These match the data visible in each agent dossier.
      </P>
      {data.agents.map((a) => <AgentRow key={a.agentId} agent={a} />)}

      <SectionHeading>Explorers</SectionHeading>
      <div style={{ display: 'flex', gap: spacing.lg, flexWrap: 'wrap', marginBottom: spacing.md }}>
        {data.explorers.walrus.map((e) => <ExternalLink key={e.name} href={e.baseUrl}>{e.name}</ExternalLink>)}
        {data.explorers.sui.map((e) => <ExternalLink key={e.name} href={e.baseUrl}>{e.name}</ExternalLink>)}
      </div>

      <SectionHeading>Feedback to Walrus / Mysten Labs</SectionHeading>
      <P style={{ color: text.dim, marginBottom: spacing.sm }}>Issues filed during development -- things we wish the ecosystem had.</P>
      {FEEDBACK_ISSUES.map((issue) => <FeedbackIssue key={issue.title} {...issue} />)}
    </div>
  )
}
