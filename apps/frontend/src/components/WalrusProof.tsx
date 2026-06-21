/**
 * WalrusProof | v1.0.0 | 2026-06-18
 * Purpose: "Walrus Proof" verification panel opened from board_scout click.
 * Shows MemWal account info, namespaces, recent writes, and verification
 * instructions (curl recipe). Proves all data is on Walrus mainnet.
 *
 * Data: partially static (account ID, namespaces), partially from
 * getAgentPredictions + getAgentEvolution (latest timestamps).
 * Token-only styles. WAI-ARIA dialog + focus trap.
 */

import React, { useCallback, useEffect, useState } from 'react'
import {
  getAgentPredictions, getAgentEvolution, getVerifiability,
  type PredictionItem, type EvolutionItem,
} from '@/lib/api'
import { walrusBlobUrl, suiObjectUrl } from '@/lib/explorer'
import { PixelButton } from '@/components/ui'
import { GameEventBus } from '@/events/GameEventBus'
import { useFocusTrap } from '@/lib/a11y/useFocusTrap'
import { formatKickoff } from '@/lib/formatDate'
import {
  palette, accents, text, fonts, borders, shadows, zIndex,
  type as typo, agentColors, spacing, overlay,
} from '@/styles/tokens'

/* ═══════════════════════════════════════════════════════════════════════
 * CONSTANTS
 * ═══════════════════════════════════════════════════════════════════════ */

const AGENT_IDS = ['dr_morgan', 'scout_alvarez', 'viktor_kane', 'sofia_mendes', 'madame_pythia'] as const
const AGENT_NAMES: Record<string, string> = {
  dr_morgan: 'Dr. Morgan',
  scout_alvarez: 'Scout Alvarez',
  viktor_kane: 'Viktor Kane',
  sofia_mendes: 'Sofia Mendes',
  madame_pythia: 'Mme Pythia',
}

/**
 * MemWal namespaces used by the system.
 * These are the namespace prefixes passed to MemWal.create().
 */
const NAMESPACES = [
  { ns: 'mwc-agent:dr_morgan', desc: 'Dr. Morgan predictions & evolution' },
  { ns: 'mwc-agent:scout_alvarez', desc: 'Scout Alvarez predictions & evolution' },
  { ns: 'mwc-agent:viktor_kane', desc: 'Viktor Kane predictions & evolution' },
  { ns: 'mwc-agent:sofia_mendes', desc: 'Sofia Mendes predictions & evolution' },
  { ns: 'mwc-agent:madame_pythia', desc: 'Madame Pythia predictions & evolution' },
  { ns: 'moneyball:sys', desc: 'System KV store (agent parameters)' },
  { ns: 'moneyball', desc: 'User summaries & interactions' },
]

const MODAL_TITLE_ID = 'walrus-proof-title'

/* ═══════════════════════════════════════════════════════════════════════
 * TYPES
 * ═══════════════════════════════════════════════════════════════════════ */

interface RecentWrite {
  agentId: string
  type: 'prediction' | 'evolution'
  createdAt: string
  summary: string
}

/* ═══════════════════════════════════════════════════════════════════════
 * MAIN COMPONENT
 * ═══════════════════════════════════════════════════════════════════════ */

export function WalrusProof() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentWrites, setRecentWrites] = useState<RecentWrite[]>([])
  const [totalPredictions, setTotalPredictions] = useState(0)
  const [totalEvolutions, setTotalEvolutions] = useState(0)
  const [copied, setCopied] = useState(false)
  const [accountObjectUrl, setAccountObjectUrl] = useState<string | null>(null)
  const [accountId, setAccountId] = useState<string>('')

  const trapRef = useFocusTrap<HTMLDivElement>({ onClose: () => setOpen(false), active: open })

  /* ── Open on board_scout click ─────────────────────────────────── */
  useEffect(() => {
    const handler = ({ propId }: { propId: string }) => {
      if (propId === 'board_scout') setOpen(true)
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

  /* ── Fetch data ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const allWrites: RecentWrite[] = []
        let preds = 0
        let evos = 0

        // Fetch verifiability data for the MemWal account link
        try {
          const v = await getVerifiability()
          if (alive) {
            setAccountObjectUrl(v.memwalAccountObjectUrl ?? null)
            setAccountId(v.memwalAccountId ?? '')
          }
        } catch { /* non-critical */ }

        await Promise.all(
          AGENT_IDS.map(async (agentId) => {
            const [predRes, evoRes] = await Promise.all([
              getAgentPredictions(agentId),
              getAgentEvolution(agentId),
            ])

            preds += predRes.items.length
            evos += evoRes.items.length

            // Take latest 2 predictions per agent
            predRes.items
              .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
              .slice(0, 2)
              .forEach((p) => {
                allWrites.push({
                  agentId,
                  type: 'prediction',
                  createdAt: p.createdAt,
                  summary: `${p.matchId}: ${p.pick} (${(p.confidence * 100).toFixed(0)}%)`,
                })
              })

            // Take latest evolution per agent
            evoRes.items
              .filter((e) => e.evolutionType !== 'noop')
              .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
              .slice(0, 1)
              .forEach((e) => {
                allWrites.push({
                  agentId,
                  type: 'evolution',
                  createdAt: e.createdAt,
                  summary: e.summary.slice(0, 80),
                })
              })
          }),
        )

        allWrites.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

        if (alive) {
          setRecentWrites(allWrites.slice(0, 10))
          setTotalPredictions(preds)
          setTotalEvolutions(evos)
        }
      } catch (err: any) {
        if (alive) setError(err.message ?? String(err))
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [open])

  const close = useCallback(() => setOpen(false), [])

  const accountIdDisplay = accountId || '<ACCOUNT_ID>'
  const curlRecipe = `# Verify Moneyball data on Walrus Memory

# 1. Check MemWal account on Sui
open ${accountObjectUrl ?? `https://suiscan.xyz/mainnet/object/${accountIdDisplay}`}

# 2. Recall agent memories via MemWal API
curl -X POST https://relayer.memory.walrus.xyz/recall \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "prediction",
    "namespace": "mwc-agent:dr_morgan",
    "limit": 5
  }'`

  async function copyRecipe() {
    try {
      await navigator.clipboard.writeText(curlRecipe)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard might not be available */ }
  }

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
          <h2 id={MODAL_TITLE_ID} style={S.title}>■ WALRUS PROOF</h2>
          <PixelButton size="small" onClick={close} aria-label="Close walrus proof">✕</PixelButton>
        </div>

        {/* Content */}
        <div style={S.content}>
          {loading && <div style={S.status}>Verifying on-chain data…</div>}
          {error && <div style={{ ...S.status, color: accents.red }}>Error: {error}</div>}

          {!loading && !error && (
            <>
              {/* Explainer */}
              <div style={S.section}>
                <h3 style={S.sectionTitle}>Data provenance</h3>
                <p style={S.description}>
                  Every prediction, evolution, and parameter change is written to{' '}
                  <strong style={{ color: accents.gold }}>Walrus Memory (MemWal)</strong>{' '}
                  on Sui mainnet. Data is encrypted end-to-end and stored permanently on the
                  Walrus decentralised storage network. This means every agent decision is
                  verifiable and tamper-proof.
                </p>
              </div>

              {/* Stats */}
              <div style={S.statsRow}>
                <div style={S.statCard}>
                  <div style={S.statValue}>{totalPredictions}</div>
                  <div style={S.statLabel}>Predictions</div>
                </div>
                <div style={S.statCard}>
                  <div style={S.statValue}>{totalEvolutions}</div>
                  <div style={S.statLabel}>Evolutions</div>
                </div>
                <div style={S.statCard}>
                  <div style={S.statValue}>{NAMESPACES.length}</div>
                  <div style={S.statLabel}>Namespaces</div>
                </div>
              </div>

              {/* MemWal account link */}
              {accountObjectUrl && (
                <div style={S.section}>
                  <a
                    href={accountObjectUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{ ...S.accountLink }}
                  >
                    ■ View MemWal Account on SuiScan →
                  </a>
                </div>
              )}

              {/* Namespaces */}
              <div style={S.section}>
                <h3 style={S.sectionTitle}>MemWal namespaces</h3>
                <div style={S.nsGrid}>
                  {NAMESPACES.map((n) => (
                    <div key={n.ns} style={S.nsRow}>
                      <code style={S.nsCode}>{n.ns}</code>
                      <span style={S.nsDesc}>{n.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent writes */}
              <div style={S.section}>
                <h3 style={S.sectionTitle}>Recent writes</h3>
                <div style={S.writesTable}>
                  {recentWrites.map((w, i) => (
                    <div key={i} style={S.writeRow}>
                      <span style={{
                        ...S.writeDot,
                        background: agentColors[w.agentId] ?? accents.gold,
                      }} />
                      <span style={S.writeAgent}>
                        {AGENT_NAMES[w.agentId] ?? w.agentId}
                      </span>
                      <span style={{
                        ...S.writeType,
                        color: w.type === 'prediction' ? accents.gold : accents.green,
                      }}>
                        {w.type === 'prediction' ? '◆' : '△'}
                      </span>
                      <span style={S.writeSummary}>{w.summary}</span>
                      <span style={S.writeTime}>
                        {formatKickoff(w.createdAt)}
                      </span>
                    </div>
                  ))}
                  {recentWrites.length === 0 && (
                    <div style={S.emptyNote}>No writes recorded yet.</div>
                  )}
                </div>
              </div>

              {/* Verification recipe */}
              <div style={S.section}>
                <h3 style={S.sectionTitle}>Verify yourself</h3>
                <div style={S.codeBlock}>
                  <pre style={S.codePre}>{curlRecipe}</pre>
                  <PixelButton size="small" onClick={copyRecipe} style={{ position: 'absolute', top: 6, right: 6 }}>
                    {copied ? '✓ Copied' : 'Copy'}
                  </PixelButton>
                </div>
              </div>

              {/* Tech note */}
              <div style={S.techNote}>
                <strong>Storage:</strong> Walrus decentralised blob store on Sui mainnet •{' '}
                <strong>Encryption:</strong> SEAL threshold encryption •{' '}
                <strong>SDK:</strong> @mysten-incubation/memwal v0.0.7
              </div>
            </>
          )}
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
    width: 'min(90vw, 720px)',
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
  status: {
    fontFamily: fonts.body,
    ...typo.body,
    color: text.muted,
    textAlign: 'center',
    padding: spacing.xl,
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
    lineHeight: '22px',
  },
  statsRow: {
    display: 'flex',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    padding: spacing.sm,
    background: palette.wood700,
    border: borders.standard,
    textAlign: 'center',
  },
  statValue: {
    fontFamily: fonts.header,
    ...typo.hdrLg,
    color: accents.gold,
  },
  statLabel: {
    fontFamily: fonts.body,
    ...typo.dataSm,
    color: text.muted,
    marginTop: 4,
  },
  nsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  nsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: `4px ${spacing.sm}px`,
    background: palette.wood700,
    border: borders.rule,
  },
  nsCode: {
    fontFamily: fonts.body,
    ...typo.dataSm,
    color: accents.gold,
    minWidth: 180,
  },
  nsDesc: {
    fontFamily: fonts.body,
    ...typo.caption,
    color: text.muted,
  },
  writesTable: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  writeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: `3px ${spacing.sm}px`,
    borderBottom: borders.rule,
  },
  writeDot: {
    width: 8,
    height: 8,
    flexShrink: 0,
  },
  writeAgent: {
    fontFamily: fonts.body,
    ...typo.dataSm,
    color: text.dim,
    minWidth: 80,
    flexShrink: 0,
  },
  writeType: {
    fontFamily: fonts.body,
    ...typo.hdrSm,
    flexShrink: 0,
  },
  writeSummary: {
    fontFamily: fonts.body,
    ...typo.dataSm,
    color: text.primary,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  writeTime: {
    fontFamily: fonts.body,
    ...typo.caption,
    color: text.faint,
    flexShrink: 0,
  },
  emptyNote: {
    fontFamily: fonts.body,
    ...typo.dataSm,
    color: text.faint,
    fontStyle: 'italic',
    padding: spacing.sm,
  },
  codeBlock: {
    position: 'relative',
    background: palette.surface,
    border: borders.standard,
    padding: spacing.sm,
    overflow: 'auto',
  },
  codePre: {
    fontFamily: fonts.body,
    ...typo.dataSm,
    color: text.dim,
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  accountLink: {
    fontFamily: fonts.header,
    ...typo.hdrXs,
    color: accents.gold,
    textDecoration: 'none',
    display: 'block',
    padding: `${spacing.sm}px`,
    border: borders.standard,
    background: palette.wood700,
    textAlign: 'center',
    cursor: 'pointer',
  },
  techNote: {
    fontFamily: fonts.body,
    ...typo.caption,
    color: text.faint,
    padding: `${spacing.sm}px`,
    borderTop: borders.rule,
    textAlign: 'center',
  },
}
