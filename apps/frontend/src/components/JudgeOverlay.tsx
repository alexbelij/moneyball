/**
 * JudgeOverlay | v1.0.0 | 2026-06-24
 * Purpose: A single, walletless, deep-linkable page for hackathon jurors
 *          (taken.wal.app/#/judge). One screen that proves the project's
 *          thesis: five agents store their memory on Walrus mainnet, and that
 *          memory changes how they predict.
 *
 * Data (all public, no wallet):
 *   - getMemoryMoment()  → per-agent before/after stats + tournament headline
 *   - getVerifiability() → on-chain links (MemWalAccount, Walrus Site object)
 *   - getAgentEvolution()→ the latest parameter diff (what actually changed)
 *
 * Styling: tokens-only, English-only, no emoji icons (design-drift guard).
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  palette, accents, text, fonts, type, borders, shadows, spacing, agentColors, overlay, zIndex,
} from '@/styles/tokens'
import { PixelIcon } from '@/components/icons/PixelIcon'
import { useFocusTrap } from '@/lib/a11y/useFocusTrap'
import { GameEventBus } from '@/events/GameEventBus'
import { useJudgeStore } from '@/store/judgeStore'
import { suiObjectUrl } from '@/lib/explorer'
import {
  getMemoryMoment, getVerifiability, getAgentEvolution, listAgents,
  type MemoryMomentResponse, type VerifiabilityData, type EvolutionItem, type AgentConfigItem,
} from '@/lib/api'

interface AgentRow {
  agentId: string
  name: string
  role: string
  pct: number | null
  correct: number
  outcomes: number
  predictions: number
  evolutions: number
  substantiveEvolutions: number
  walrusWrites: number
  mood: string
  lastEvolution: string | null
  latestDiff: Array<[string, number]>
}

function prettyId(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Latest substantive evolution → param diff entries (most recent first). */
function latestDiffOf(items: EvolutionItem[]): Array<[string, number]> {
  const withDiff = items.filter((e) => e.parameterDiff && Object.keys(e.parameterDiff).length > 0)
  if (withDiff.length === 0) return []
  const last = withDiff[withDiff.length - 1]
  return Object.entries(last.parameterDiff ?? {}) as Array<[string, number]>
}

export function JudgeOverlay() {
  const open = useJudgeStore((s) => s.open)
  const close = useJudgeStore((s) => s.closeJudge)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [moment, setMoment] = useState<MemoryMomentResponse | null>(null)
  const [verify, setVerify] = useState<VerifiabilityData | null>(null)
  const [rows, setRows] = useState<AgentRow[]>([])
  const [attempt, setAttempt] = useState(0)

  const trapRef = useFocusTrap<HTMLDivElement>({ onClose: close, active: open })

  // Pause the cabinet scene while the judge page is open (no-op if not booted).
  useEffect(() => {
    if (!open) return
    GameEventBus.emit('scene:pause', undefined)
    return () => {
      GameEventBus.emit('scene:resume', undefined)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const [mm, vf, ag] = await Promise.all([
          getMemoryMoment(),
          getVerifiability(),
          listAgents().catch(() => ({ agents: [] as AgentConfigItem[] })),
        ])
        if (cancelled) return

        const nameById = new Map<string, AgentConfigItem>()
        for (const a of ag.agents ?? []) nameById.set(a.agentId, a)

        // Latest param diffs per agent (best-effort, parallel, never blocks).
        const diffs = await Promise.all(
          mm.agents.map((a) =>
            getAgentEvolution(a.agentId)
              .then((r) => latestDiffOf(r.items))
              .catch(() => [] as Array<[string, number]>),
          ),
        )
        if (cancelled) return

        const built: AgentRow[] = mm.agents.map((a, i) => {
          const meta = nameById.get(a.agentId)
          return {
            agentId: a.agentId,
            name: meta?.name ?? prettyId(a.agentId),
            role: meta?.role ?? '',
            pct: a.accuracy.pct,
            correct: a.accuracy.correct,
            outcomes: a.accuracy.outcomes,
            predictions: a.accuracy.predictions,
            evolutions: a.evolutions,
            substantiveEvolutions: a.substantiveEvolutions,
            walrusWrites: a.walrusWrites,
            mood: a.mood?.mood ?? 'neutral',
            lastEvolution: a.lastEvolution,
            latestDiff: diffs[i] ?? [],
          }
        })

        setMoment(mm)
        setVerify(vf)
        setRows(built)
        setLoading(false)
      } catch {
        if (cancelled) return
        setError('Could not reach the live backend (it may be waking up). Please retry.')
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, attempt])

  const totals = useMemo(() => {
    if (!moment) return null
    const writes = moment.agents.reduce((s, a) => s + a.walrusWrites, 0)
    const evolutions = moment.agents.reduce((s, a) => s + a.substantiveEvolutions, 0)
    const accs = moment.agents.map((a) => a.accuracy.pct).filter((p): p is number => p !== null)
    const avg = accs.length ? Math.round(accs.reduce((s, v) => s + v, 0) / accs.length) : null
    return { writes, evolutions, avg, day: moment.tournamentDay }
  }, [moment])

  if (!open) return null

  return (
    <div style={S.backdrop} onClick={close} role="presentation">
      <div
        ref={trapRef}
        style={S.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="For judges — memory moment"
        data-testid="judge-overlay"
      >
        {/* Header */}
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <PixelIcon name="walrus" size={18} color={accents.gold} />
            <span style={S.title}>FOR JUDGES</span>
            <span style={S.badge}>MEMORY MOMENT</span>
          </div>
          <button onClick={close} style={S.closeBtn} aria-label="Close judge page">✕</button>
        </div>

        <p style={S.intro}>
          Five agents predict real World Cup fixtures. Their memory lives on Walrus mainnet —
          and it changes how they predict. This page reads the live backend so you can verify
          it without a wallet.
        </p>

        {loading && (
          <div style={S.note}>
            <span style={S.noteText}>Reading live memory from the backend…</span>
          </div>
        )}

        {error && !loading && (
          <div style={S.note}>
            <span style={{ ...S.noteText, color: accents.red }}>{error}</span>
            <button style={S.retryBtn} onClick={() => setAttempt((n) => n + 1)}>RETRY</button>
          </div>
        )}

        {!loading && !error && totals && (
          <>
            {/* Headline stats */}
            <div style={S.statRow}>
              <Stat label="Tournament day" value={String(totals.day)} />
              <Stat label="Memories on Walrus" value={String(totals.writes)} accent />
              <Stat label="Substantive evolutions" value={String(totals.evolutions)} />
              <Stat label="Avg accuracy" value={totals.avg !== null ? `${totals.avg}%` : '—'} />
            </div>

            {/* Judging map */}
            <div style={S.criteria}>
              <Crit
                tag="C1"
                title="Memory depth & authenticity"
                body="Each agent's parameters move only after real outcomes resolve. Every prediction and reflection is persisted to Walrus (MemWal), so the history is durable and auditable — not a chat log."
              />
              <Crit
                tag="C2"
                title="Creativity"
                body="A 16-bit pixel-art manager's cabinet with five distinct methodologies — Bayesian, scout, contrarian, EV, numerology — that openly disagree on the same fixture."
              />
              <Crit
                tag="C3"
                title="Technical"
                body="Live on Walrus mainnet: the site is a Walrus Site and agent memory writes go to MemWal on Sui mainnet. Numbers are deterministic; the LLM only phrases them."
              />
            </div>

            {/* Per-agent rows */}
            <h3 style={S.sectionH}>What memory changed, per agent</h3>
            <div style={S.agents}>
              {rows.map((r) => {
                const color = agentColors[r.agentId] ?? accents.gold
                return (
                  <div key={r.agentId} style={S.agentCard}>
                    <div style={S.agentHead}>
                      <PixelIcon name={r.agentId} size={16} color={color} />
                      <span style={{ ...S.agentName, color }}>{r.name.toUpperCase()}</span>
                      {r.role && <span style={S.agentRole}>{r.role}</span>}
                      <span style={S.moodTag}>{r.mood}</span>
                    </div>

                    <div style={S.metricRow}>
                      <Metric label="Accuracy" value={r.pct !== null ? `${r.pct}%` : '—'} sub={`${r.correct}/${r.outcomes} resolved`} />
                      <Metric label="Evolutions" value={String(r.substantiveEvolutions)} sub={`${r.evolutions} cycles`} />
                      <Metric label="Walrus writes" value={String(r.walrusWrites)} sub="memories stored" />
                    </div>

                    {r.latestDiff.length > 0 && (
                      <div style={S.diffWrap}>
                        <span style={S.diffLabel}>Latest parameter shift</span>
                        <div style={S.diffGrid}>
                          {r.latestDiff.map(([k, d]) => (
                            <div key={k} style={S.diffRow}>
                              <span style={S.diffKey}>{k}</span>
                              <span
                                style={{
                                  ...S.diffVal,
                                  color: d > 0 ? accents.green : d < 0 ? accents.red : text.dim,
                                }}
                              >
                                {d > 0 ? '+' : ''}{typeof d === 'number' ? d.toFixed(3) : d}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {r.lastEvolution && (
                      <p style={S.reason}>"{r.lastEvolution}"</p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Verify on-chain */}
            {verify && (
              <div style={S.verify}>
                <h3 style={S.sectionH}>Verify on-chain</h3>
                <div style={S.verifyLinks}>
                  {verify.memwalAccountObjectUrl && (
                    <a style={S.verifyLink} href={verify.memwalAccountObjectUrl} target="_blank" rel="noreferrer noopener">
                      <PixelIcon name="walrus" size={12} color={accents.gold} />
                      <span style={S.verifyLinkText}>MemWalAccount on Sui mainnet →</span>
                    </a>
                  )}
                  {verify.walrusSiteObject && (
                    <a style={S.verifyLink} href={suiObjectUrl(verify.walrusSiteObject)} target="_blank" rel="noreferrer noopener">
                      <PixelIcon name="walrus" size={12} color={accents.gold} />
                      <span style={S.verifyLinkText}>Walrus Site object (this app is hosted on Walrus) →</span>
                    </a>
                  )}
                </div>
                <p style={S.namespace}>
                  Memory namespace: <span style={S.mono}>{verify.memwalNamespacePattern}</span>
                </p>
                <p style={S.honest}>
                  Honest note: v1 derives team strengths from a deterministic hash as a stand-in
                  for full statistical features (xG, form). Brier and accuracy are scored against
                  real match outcomes; on-chain memory is real.
                </p>
              </div>
            )}

            <div style={S.footer}>
              <button style={S.cta} onClick={close}>ENTER THE CABINET →</button>
              <span style={S.footerNote}>Open any agent in the cabinet for its full dossier and Evolution tab.</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Small presentational helpers ─────────────────────────────────────── */

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={S.stat}>
      <span style={{ ...S.statValue, color: accent ? accents.gold : text.primary }}>{value}</span>
      <span style={S.statLabel}>{label}</span>
    </div>
  )
}

function Crit({ tag, title, body }: { tag: string; title: string; body: string }) {
  return (
    <div style={S.critCard}>
      <div style={S.critHead}>
        <span style={S.critTag}>{tag}</span>
        <span style={S.critTitle}>{title}</span>
      </div>
      <p style={S.critBody}>{body}</p>
    </div>
  )
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={S.metric}>
      <span style={S.metricLabel}>{label}</span>
      <span style={S.metricValue}>{value}</span>
      <span style={S.metricSub}>{sub}</span>
    </div>
  )
}

/* ── Styles (tokens-only) ─────────────────────────────────────────────── */
const S: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, background: overlay,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    zIndex: zIndex.wallet, padding: spacing.md, overflowY: 'auto',
  },
  panel: {
    background: palette.wood900, border: borders.standard, boxShadow: shadows.hard,
    padding: spacing.lg, maxWidth: 780, width: '96vw', margin: `${spacing.lg}px 0`,
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.sm, borderBottom: borders.rule, paddingBottom: spacing.sm,
    gap: 8, flexWrap: 'wrap',
  },
  title: { fontFamily: fonts.header, ...type.hdr, color: accents.gold },
  badge: {
    fontFamily: fonts.header, ...type.hdrXs, color: text.muted,
    border: borders.standard, padding: '2px 6px',
  },
  closeBtn: {
    background: 'none', border: 'none', color: text.muted, cursor: 'pointer',
    fontFamily: fonts.header, ...type.hdrSm,
  },
  intro: {
    fontFamily: fonts.body, ...type.body, color: text.dim,
    margin: `0 0 ${spacing.md}px`, maxWidth: 680,
  },
  note: {
    display: 'flex', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, justifyContent: 'center',
  },
  noteText: { fontFamily: fonts.body, ...type.body, color: text.muted },
  retryBtn: {
    fontFamily: fonts.header, ...type.hdrXs, color: accents.gold,
    background: palette.surface, border: borders.standard, padding: '4px 10px', cursor: 'pointer',
  },
  statRow: {
    display: 'flex', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md,
  },
  stat: {
    flex: '1 1 130px', background: palette.surface, border: borders.rule,
    padding: spacing.sm, display: 'flex', flexDirection: 'column', gap: 2,
  },
  statValue: { fontFamily: fonts.header, ...type.hdr },
  statLabel: { fontFamily: fonts.body, ...type.caption, color: text.faint },
  criteria: {
    display: 'flex', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md,
  },
  critCard: {
    flex: '1 1 220px', background: palette.surface, border: borders.rule, padding: spacing.sm,
  },
  critHead: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 },
  critTag: {
    fontFamily: fonts.header, ...type.hdrXs, color: palette.wood900,
    background: accents.gold, padding: '1px 5px',
  },
  critTitle: { fontFamily: fonts.header, ...type.hdrXs, color: text.primary },
  critBody: { fontFamily: fonts.body, ...type.dataSm, color: text.muted, margin: '4px 0 0' },
  sectionH: {
    fontFamily: fonts.header, ...type.hdrSm, color: text.muted,
    margin: `${spacing.md}px 0 ${spacing.sm}px`,
  },
  agents: { display: 'flex', flexDirection: 'column', gap: spacing.sm },
  agentCard: { background: palette.surface, border: borders.rule, padding: spacing.sm },
  agentHead: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 },
  agentName: { fontFamily: fonts.header, ...type.hdrXs },
  agentRole: { fontFamily: fonts.body, ...type.caption, color: text.faint },
  moodTag: {
    fontFamily: fonts.header, ...type.caption, color: text.muted,
    border: borders.rule, padding: '0 5px', marginLeft: 'auto',
  },
  metricRow: { display: 'flex', flexWrap: 'wrap', gap: spacing.sm, marginBottom: 6 },
  metric: {
    flex: '1 1 110px', display: 'flex', flexDirection: 'column', gap: 1,
    borderLeft: borders.rule, paddingLeft: spacing.sm,
  },
  metricLabel: { fontFamily: fonts.body, ...type.caption, color: text.faint },
  metricValue: { fontFamily: fonts.header, ...type.hdrXs, color: text.primary },
  metricSub: { fontFamily: fonts.body, ...type.caption, color: text.faint },
  diffWrap: { marginTop: 4, marginBottom: 6 },
  diffLabel: { fontFamily: fonts.body, ...type.caption, color: text.faint },
  diffGrid: { display: 'flex', flexWrap: 'wrap', gap: spacing.sm, marginTop: 2 },
  diffRow: { display: 'flex', alignItems: 'center', gap: 6 },
  diffKey: { fontFamily: fonts.body, ...type.dataSm, color: text.muted },
  diffVal: { fontFamily: fonts.body, ...type.dataSm },
  reason: { fontFamily: fonts.body, ...type.dataSm, color: text.dim, margin: '4px 0 0', fontStyle: 'italic' },
  verify: { marginTop: spacing.md, paddingTop: spacing.sm, borderTop: borders.rule },
  verifyLinks: { display: 'flex', flexDirection: 'column', gap: spacing.xs },
  verifyLink: { display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' },
  verifyLinkText: { fontFamily: fonts.body, ...type.body, color: accents.gold, textDecoration: 'underline' },
  namespace: { fontFamily: fonts.body, ...type.dataSm, color: text.muted, margin: `${spacing.sm}px 0 0` },
  mono: { fontFamily: fonts.body, color: text.dim },
  honest: { fontFamily: fonts.body, ...type.caption, color: text.faint, margin: `${spacing.sm}px 0 0`, maxWidth: 680 },
  footer: {
    marginTop: spacing.md, paddingTop: spacing.sm, borderTop: borders.rule,
    display: 'flex', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap',
  },
  cta: {
    fontFamily: fonts.header, ...type.hdrXs, color: palette.wood900, background: accents.gold,
    border: borders.standard, padding: '6px 12px', cursor: 'pointer',
  },
  footerNote: { fontFamily: fonts.body, ...type.caption, color: text.faint },
}
