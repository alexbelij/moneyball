/**
 * AgentModal | v1.2.0 | 2026-06-18
 * Purpose: Agent dossier — Overview (actions) + Method / Predictions /
 * Evolution / Before/After / Memory tabs. WAI-ARIA dialog + tabs, focus trap.
 * T67: useAsyncAction for Roast/Disagree/Day+1, busy PixelButton, skeleton loaders.
 * T58: Performance pass — extracted static styles to module-level constants,
 *   React.memo on list-item sub-components, useMemo for derived data.
 * T49: typography scale — body >=16px, header >=10px; responsive content.
 * T48: Redesigned from right-side drawer to centered modal (min(80vw,980px),
 *   max-height 86vh), backdrop blur (CSS module), Phaser scene pause/resume
 *   via GameEventBus, SNES-bevel frame from tokens.
 * T36: "Day 1 vs Day N" before/after comparison panel — the demo money-shot.
 * T35: scrim backdrop uses semantic `overlay` token.
 * T33: migrated to shared tokens (fixed wrong wood-700/500 values).
 * T30: Method tab discloses honest model-input provenance (synthetic v1).
 * T28: Evolution tab renders a deterministic human-readable story per event.
 * T27: Predictions tab now shows a per-agent rolling-Brier performance chart.
 */

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import {
  roast, disagree, adminDayPlusOne,
  getAgentProfile, getAgentPredictions, getAgentEvolution, getAgentParams, getDataSource,
  type PredictionItem, type EvolutionItem, type AgentProfile,
} from '@/lib/api'
import { buildBeforeAfterDiff, type BeforeAfterDiff, type ParamDiffEntry } from '@/lib/beforeAfterDiff'
import { GameEventBus } from '@/events/GameEventBus'
import { useAuthStore } from '@/store/authStore'
import { useFocusTrap } from '@/lib/a11y/useFocusTrap'
import { useRovingTabs } from '@/lib/a11y/useRovingTabs'
import { PixelButton } from '@/components/ui/PixelButton'
import { AgentChat } from '@/components/AgentChat'
import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { AgentPerfChart } from '@/components/AgentPerfChart'
import { buildAgentPerfSeries } from '@/lib/agentPerf'
import { buildEvolutionStory } from '@/lib/evolutionStory'
import { palette, accents, text, fonts, borders, shadows, zIndex, overlay, type as typo } from '@/styles/tokens'
import { formatTimestamp } from '@/lib/formatDate'
import { AgentJournal } from '@/components/AgentJournal'
import { TimelineScrubber } from '@/components/TimelineScrubber'
import { MemoryPulse } from '@/components/MemoryPulse'
import css from './agentModal.module.css'

type Tab = 'overview' | 'method' | 'predictions' | 'evolution' | 'before-after' | 'memory' | 'journal' | 'chat'
const TABS: readonly Tab[] = ['overview', 'method', 'predictions', 'evolution', 'before-after', 'memory', 'journal', 'chat'] as const
const MODAL_TITLE_ID = 'agent-modal-title'

/* ── Static style constants (T58: avoid re-creation on each render) ───── */

const CARD: React.CSSProperties = {
  background: palette.surface,
  border: borders.standard,
  borderRadius: 0,
  padding: 8,
  marginBottom: 8,
  boxShadow: shadows.hardSmall,
}

const S_DIALOG: React.CSSProperties = {
  width: 'min(95vw, 980px)',
  maxHeight: '86vh',
  background: palette.wood900,
  border: borders.standard,
  boxShadow: `${shadows.hard}, ${shadows.bevelInset}`,
  padding: 20,
  color: palette.paper,
  fontFamily: fonts.body,
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
}

const S_HEADER_ROW: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'start',
}

const S_TITLE: React.CSSProperties = {
  ...typo.hdr, fontWeight: 700, fontFamily: fonts.header,
  color: accents.gold, letterSpacing: '-0.5px',
}

const S_ROLE: React.CSSProperties = { ...typo.body, color: text.muted, marginTop: 2 }
const S_STATUS: React.CSSProperties = { marginTop: 8, ...typo.body, color: text.dim }

const S_TABLIST: React.CSSProperties = {
  marginTop: 16, display: 'flex', gap: 4, flexWrap: 'wrap',
}

const S_PANEL: React.CSSProperties = {
  marginTop: 12, flex: 1, overflowY: 'auto', minHeight: 0,
}

const S_ACTIONS_ROW: React.CSSProperties = {
  display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
}

const S_ERROR: React.CSSProperties = { marginTop: 8, color: accents.red, ...typo.body }
const S_THOUGHT_LABEL: React.CSSProperties = { marginTop: 16, ...typo.body, color: text.muted }
const S_THOUGHT_TEXT: React.CSSProperties = { marginTop: 8, ...typo.body }

const S_FOOTER: React.CSSProperties = {
  marginTop: 12, ...typo.caption, color: text.muted,
  borderTop: borders.standard, paddingTop: 8,
}

const S_SECTION_LABEL: React.CSSProperties = {
  ...typo.hdrSm, fontFamily: fonts.header, color: text.muted,
  letterSpacing: '-0.5px', textTransform: 'uppercase',
}

const S_BODY_MT4: React.CSSProperties = { ...typo.body, marginTop: 4 }
const S_CAPTION_MUTED_MT8: React.CSSProperties = { marginTop: 8, ...typo.caption, color: text.muted }
const S_CAPTION_MUTED_MT4: React.CSSProperties = { marginTop: 4, ...typo.caption, color: text.muted }
const S_BODY_DIM_ITALIC: React.CSSProperties = { ...typo.body, marginTop: 4, color: text.dim, fontStyle: 'italic' }
const S_DATASM_MUTED: React.CSSProperties = { ...typo.dataSm, color: text.muted }
const S_DATASM_MUTED_MB8: React.CSSProperties = { ...typo.dataSm, color: text.muted, marginBottom: 8 }
const S_BODY_MT6: React.CSSProperties = { marginTop: 8, ...typo.body }

const S_FORMULA_PRE: React.CSSProperties = {
  margin: '8px 0 0', padding: 8,
  background: palette.surface, border: borders.rule, borderRadius: 0,
  ...typo.caption, color: accents.green, fontFamily: 'monospace',
  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
}

const S_RULE_NAME: React.CSSProperties = { ...typo.dataSm, color: accents.gold, fontWeight: 700 }
const S_RULE_LOGIC: React.CSSProperties = { ...typo.caption, color: text.dim, marginTop: 2 }
const S_RULE_EFFECT: React.CSSProperties = { ...typo.caption, color: accents.green, marginTop: 2, fontFamily: 'monospace' }

const S_PARAM_KEY: React.CSSProperties = { color: text.muted }
const S_PARAM_VAL: React.CSSProperties = { color: palette.paper }
const S_PARAM_ROW: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between',
  ...typo.caption, fontFamily: 'monospace', marginTop: 2,
}

const S_DATASM_DIM_MT4: React.CSSProperties = { ...typo.dataSm, marginTop: 4, color: text.dim }

const S_DATA_INPUT_HEADER: React.CSSProperties = {
  ...typo.caption, color: accents.gold, marginTop: 4, display: 'flex',
  alignItems: 'center', gap: 8,
}

const S_DATA_INPUT_ITEM: React.CSSProperties = {
  marginTop: 8, paddingTop: 8, borderTop: borders.rule,
}

const S_DATA_INPUT_LABEL_ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 }
const S_DATA_INPUT_LABEL: React.CSSProperties = { ...typo.dataSm, color: palette.paper }

const S_NO_CHART: React.CSSProperties = {
  ...typo.caption, color: text.muted, border: borders.standard,
  background: palette.surface, padding: 8, marginBottom: 8, textAlign: 'center',
}

const S_PRED_HEADER: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', ...typo.dataSm }
const S_PRED_MATCH: React.CSSProperties = { color: text.dim }
const S_PRED_BODY: React.CSSProperties = { marginTop: 4, ...typo.body }
const S_PRED_REASONING: React.CSSProperties = { marginTop: 4, ...typo.dataSm, color: text.muted }

const S_EVO_HEADLINE: React.CSSProperties = { ...typo.dataSm, color: accents.gold, fontWeight: 700 }
const S_EVO_DIFF_BLOCK: React.CSSProperties = { marginTop: 8, ...typo.caption, fontFamily: 'monospace' }

const S_BRIER_ROW: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  marginTop: 8, ...typo.dataSm, fontFamily: 'monospace',
}

const S_BRIER_LABEL: React.CSSProperties = { ...typo.hdrSm, color: text.muted }
const S_BRIER_VALUE: React.CSSProperties = { ...typo.bodyLg, color: text.dim }
const S_BRIER_ARROW: React.CSSProperties = { ...typo.bodyLg, color: text.muted }

const S_DIFF_GRID_HEADER: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 60px 60px 70px',
  ...typo.hdrSm, color: text.muted, fontFamily: 'monospace',
  paddingBottom: 4, borderBottom: borders.rule,
}

const S_DIFF_GRID_ROW: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 60px 60px 70px',
  ...typo.caption, fontFamily: 'monospace',
  padding: '4px 0', borderBottom: borders.rule,
}

const S_DIFF_LABEL: React.CSSProperties = {
  color: text.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}

const S_RIGHT_MUTED: React.CSSProperties = { textAlign: 'right', color: text.muted }
const S_RIGHT_PAPER: React.CSSProperties = { textAlign: 'right', color: palette.paper }

const S_EVO_COUNT: React.CSSProperties = {
  ...typo.caption, color: text.muted, marginTop: 4, textAlign: 'center',
}

const S_PARAM_BAR_ROW: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, marginTop: 8,
  ...typo.caption, fontFamily: 'monospace',
}

const S_PARAM_BAR_LABEL: React.CSSProperties = {
  width: 120, color: text.muted, overflow: 'hidden', textOverflow: 'ellipsis',
}

const S_PARAM_BAR_TRACK: React.CSSProperties = {
  flex: 1, height: 6, background: palette.surface,
  border: borders.rule, borderRadius: 0, position: 'relative',
}

const S_PARAM_BAR_CENTER: React.CSSProperties = {
  position: 'absolute', left: '50%', top: -1, width: 1,
  height: 'calc(100% + 2px)', background: palette.wood700,
}

const S_PARAM_BAR_VALUE: React.CSSProperties = {
  width: 52, textAlign: 'right', color: text.dim,
}

const S_TOPIC_LABEL: React.CSSProperties = { marginTop: 10, ...typo.caption, color: text.muted }

const CARD_GOLD: React.CSSProperties = { ...CARD, borderColor: accents.gold, borderWidth: 2 }

/* ── Main component ───────────────────────────────────────────────────── */

export function AgentModal() {
  const selected = useGameStore((s) => s.ui.selectedAgentId)
  const agent = useGameStore((s) => (selected ? s.agents[selected] : null))
  const close = () => useGameStore.getState().selectAgent(null)

  const viewer = useAuthStore((s) => s.viewer)
  const isAdmin = viewer?.role === 'admin'

  const [tab, setTab] = useState<Tab>('overview')

  const trapRef = useFocusTrap<HTMLDivElement>({ onClose: close, active: !!agent })
  const { getTabProps, getTabPanelProps, getTabListProps } = useRovingTabs({
    tabs: TABS,
    activeTab: tab,
    onSelect: setTab,
  })

  useEffect(() => { setTab('overview') }, [selected])

  /* T48: pause Phaser scene while modal is open */
  useEffect(() => {
    if (!agent) return
    GameEventBus.emit('scene:pause', undefined)
    return () => { GameEventBus.emit('scene:resume', undefined) }
  }, [agent])

  if (!agent) return null
  const agentId = agent.agentId

  /* T67: useAsyncAction guards all three buttons */
  const roastAction = useAsyncAction(
    useCallback(async () => {
      const r = await roast(agentId)
      GameEventBus.emit('thought:show', { agentId, text: r.text, duration: 3500 })
    }, [agentId]),
    { onError: 'toast' },
  )

  const disagreeAction = useAsyncAction(
    useCallback(async () => {
      await disagree(agentId)
      const r = await roast(agentId)
      GameEventBus.emit('thought:show', { agentId, text: r.text, duration: 3500 })
    }, [agentId]),
    { onError: 'toast' },
  )

  const dayPlusOneAction = useAsyncAction(
    useCallback(async () => {
      await adminDayPlusOne(agentId)
      const r = await roast(agentId)
      GameEventBus.emit('thought:show', { agentId, text: `[Day+1] ${r.text}`, duration: 4000 })
    }, [agentId]),
    { onError: 'toast' },
  )

  const busy = roastAction.pending || disagreeAction.pending || dayPlusOneAction.pending

  return (
    <div
      className={css.scrim}
      onClick={close}
      style={{ background: overlay, zIndex: zIndex.modal }}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={MODAL_TITLE_ID}
        onClick={(e) => e.stopPropagation()}
        style={S_DIALOG}
      >
        {/* Header */}
        <div style={S_HEADER_ROW}>
          <div>
            <div id={MODAL_TITLE_ID} style={S_TITLE}>{agent.name}</div>
            <div style={S_ROLE}>{agent.role}</div>
            <div style={S_STATUS}>Status: <b>{agent.status}</b></div>
          </div>
          <PixelButton variant="ghost" size="small" onClick={close} aria-label="Close agent modal">
            ✕
          </PixelButton>
        </div>

        {/* Tabs */}
        <div style={S_TABLIST} {...getTabListProps()}>
          {TABS.map((t) => (
            <PixelButton
              key={t}
              variant={tab === t ? 'primary' : 'default'}
              size="small"
              onClick={() => setTab(t)}
              {...getTabProps(t)}
              style={{ textTransform: t === 'before-after' ? 'none' : 'capitalize', fontSize: typo.hdr.fontSize }}
            >
              {t === 'before-after' ? 'Day1 vs Now' : t === 'journal' ? 'Journal' : t}
            </PixelButton>
          ))}
        </div>

        {/* Tab panel */}
        <div style={S_PANEL} {...getTabPanelProps(tab)}>
          {tab === 'overview' && (
            <>
              <div style={S_ACTIONS_ROW}>
                <PixelButton busy={roastAction.pending} disabled={busy || !viewer} onClick={roastAction.run}>
                  Roast me{!viewer ? ' (connect wallet)' : ''}
                </PixelButton>
                <PixelButton busy={disagreeAction.pending} disabled={busy || !viewer} onClick={disagreeAction.run} variant="danger">
                  Disagree{!viewer ? ' (connect wallet)' : ''}
                </PixelButton>
                {isAdmin && (
                  <PixelButton busy={dayPlusOneAction.pending} disabled={busy} onClick={dayPlusOneAction.run} variant="primary">
                    Simulate Day +1
                  </PixelButton>
                )}
              </div>
              <div style={S_THOUGHT_LABEL}>Last thought:</div>
              <div style={S_THOUGHT_TEXT}>{agent.lastThought ?? '—'}</div>
            </>
          )}
          {tab === 'method' && <MethodTab agentId={agentId} />}
          {tab === 'predictions' && <PredictionsTab agentId={agentId} />}
          {tab === 'evolution' && <EvolutionTab agentId={agentId} />}
          {tab === 'before-after' && <BeforeAfterTab agentId={agentId} />}
          {tab === 'memory' && <MemoryTab agentId={agentId} />}
          {tab === 'journal' && <AgentJournal agentId={agentId} />}
          {tab === 'chat' && <AgentChat agentId={agentId} agentName={agent?.name ?? agentId} />}
        </div>

        <div style={S_FOOTER}>
          Identity: {viewer ? `Sui (${viewer.role})` : 'Guest'}
        </div>
      </div>
    </div>
  )
}

// ── Data fetching hook ──────────────────────────────────────────────────────

function useFetch<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; err: string | null; loading: boolean }>({ data: null, err: null, loading: true })
  useEffect(() => {
    let alive = true
    setState({ data: null, err: null, loading: true })
    load().then(
      (data) => alive && setState({ data, err: null, loading: false }),
      (e: any) => alive && setState({ data: null, err: e?.message ?? String(e), loading: false }),
    )
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

// ── Tab panels ──────────────────────────────────────────────────────────────

export function MethodTab({ agentId }: { agentId: string }) {
  const { data, err, loading } = useFetch(() => getAgentProfile(agentId), [agentId])
  if (loading) return <Skeleton variant="text" lines={4} />
  if (err) return <Hint color={accents.red}>{err}</Hint>
  const profile = data?.profile as AgentProfile | undefined
  if (!profile) return <Hint>No profile available.</Hint>

  const m = profile.methodology
  const params = Object.entries(m.parameters ?? {})

  return (
    <div>
      {/* Personality */}
      <div style={CARD}>
        <SectionLabel>Approach</SectionLabel>
        <div style={S_BODY_MT4}>{profile.personality}</div>
        <div style={S_CAPTION_MUTED_MT8}>
          model: <b style={S_PARAM_VAL}>{m.type}</b>
        </div>
      </div>

      {/* Catchphrases */}
      {profile.catchphrases.length > 0 && (
        <div style={CARD}>
          <SectionLabel>Catchphrases</SectionLabel>
          {profile.catchphrases.map((c, i) => (
            <div key={i} style={S_BODY_DIM_ITALIC}>"{c}"</div>
          ))}
        </div>
      )}

      {/* Formula (weighted/EV/contrarian agents) */}
      {m.formula && (
        <div style={CARD}>
          <SectionLabel>Scoring formula</SectionLabel>
          <pre style={S_FORMULA_PRE}>{m.formula}</pre>
        </div>
      )}

      {/* Rule list (Madame Pythia / deterministic mysticism) */}
      {m.rules.length > 0 && (
        <div style={CARD}>
          <SectionLabel>Rules</SectionLabel>
          {m.description && (
            <div style={S_CAPTION_MUTED_MT4}>{m.description}</div>
          )}
          {m.rules.map((r, i) => (
            <div
              key={i}
              style={{ marginTop: 8, paddingTop: 8, borderTop: i === 0 ? 'none' : borders.rule }}
            >
              <div style={S_RULE_NAME}>{r.name}</div>
              <div style={S_RULE_LOGIC}>{r.logic}</div>
              <div style={S_RULE_EFFECT}>→ {r.effect}</div>
            </div>
          ))}
        </div>
      )}

      {/* Parameters */}
      {params.length > 0 && (
        <div style={CARD}>
          <SectionLabel>Parameters</SectionLabel>
          <div style={{ marginTop: 4 }}>
            {params.map(([k, v]) => (
              <div key={k} style={S_PARAM_ROW}>
                <span style={S_PARAM_KEY}>{k}</span>
                <span style={S_PARAM_VAL}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evolution trigger */}
      {m.evolutionTrigger && (
        <div style={CARD}>
          <SectionLabel>How it evolves</SectionLabel>
          <div style={S_DATASM_DIM_MT4}>{m.evolutionTrigger}</div>
        </div>
      )}

      {/* T30: honest data-source disclosure */}
      <DataInputsCard />
    </div>
  )
}

/**
 * T30: honest disclosure of what the prediction engine actually runs on. The
 * agents narrate "xG model: ..." but the numbers are synthetic placeholders —
 * we say so plainly here so users/judges are never misled.
 */
export function DataInputsCard() {
  const { data, err, loading } = useFetch(() => getDataSource(), [])
  if (loading || err || !data) return null
  return (
    <div style={CARD}>
      <SectionLabel>Data inputs</SectionLabel>
      <div style={S_DATA_INPUT_HEADER}>
        <SourceBadge source="synthetic" />
        <span>{data.headline}</span>
      </div>
      <div style={{ marginTop: 8 }}>
        {data.inputs.map((inp) => (
          <div key={inp.key} style={S_DATA_INPUT_ITEM}>
            <div style={S_DATA_INPUT_LABEL_ROW}>
              <SourceBadge source={inp.source} />
              <span style={S_DATA_INPUT_LABEL}>{inp.label}</span>
            </div>
            <div style={S_CAPTION_MUTED_MT4}>{inp.detail}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* T58: memo avoids re-render when parent state changes but source stays same */
const SourceBadge = memo(function SourceBadge({ source }: { source: 'synthetic' | 'manual' | 'live' }) {
  const color = source === 'live' ? accents.green : source === 'manual' ? text.dim : accents.red
  return (
    <span style={{
      ...typo.hdrXs, fontFamily: fonts.header, letterSpacing: '-0.5px',
      textTransform: 'uppercase', color: palette.wood900,
      background: color, padding: '2px 5px', border: borders.rule,
      whiteSpace: 'nowrap',
    }}>
      {source}
    </span>
  )
})

const SectionLabel = memo(function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={S_SECTION_LABEL}>{children}</div>
})

function PredictionsTab({ agentId }: { agentId: string }) {
  const { data, err, loading } = useFetch(() => getAgentPredictions(agentId), [agentId])

  /* T58: memoize reversed list + derived stats */
  const { items, correct, resolved, perf } = useMemo(() => {
    const raw = data?.items ?? []
    const reversed = raw.slice().reverse()
    const res = reversed.filter((p) => p.outcome)
    const cor = res.filter((p) => p.outcome!.correct).length
    const pf = buildAgentPerfSeries(agentId, raw)
    return { items: reversed, correct: cor, resolved: res, perf: pf }
  }, [data, agentId])

  if (loading) return <SkeletonRows count={5} />
  if (err) return <Hint color={accents.red}>{err}</Hint>
  if (!items.length) return <Hint>No predictions yet — waiting for the next fixture window.</Hint>

  return (
    <div>
      {perf.resolvedCount >= 2 ? (
        <AgentPerfChart series={perf} />
      ) : (
        <div style={S_NO_CHART}>
          Need ≥2 resolved matches to chart this scout's accuracy.
        </div>
      )}
      <div style={S_DATASM_MUTED_MB8}>
        Record: <b style={S_PARAM_VAL}>{correct}/{resolved.length}</b> resolved · {items.length} total
      </div>
      {items.map((p) => <PredictionRow key={p.predictionId ?? `${p.matchId}:${p.createdAt}`} p={p} />)}
    </div>
  )
}

/* T58: memo prevents re-render of every row when sibling state changes */
const PredictionRow = memo(function PredictionRow({ p }: { p: PredictionItem }) {
  const badge = p.outcome ? (p.outcome.correct ? '✓' : '✗') : '…'
  const badgeColor = p.outcome ? (p.outcome.correct ? accents.green : accents.red) : text.muted
  return (
    <div style={CARD}>
      <div style={S_PRED_HEADER}>
        <span style={S_PRED_MATCH}>{p.matchId}</span>
        <span style={{ color: badgeColor, fontWeight: 700 }} aria-label={p.outcome ? (p.outcome.correct ? 'Correct' : 'Incorrect') : 'Pending'}>{badge}</span>
      </div>
      <div style={S_PRED_BODY}>
        Pick <b>{p.pick}</b> · confidence <b>{Math.round(p.confidence * 100)}%</b>
        {typeof p.paramsVersion === 'number' && <span style={S_PARAM_KEY}> · params v{p.paramsVersion}</span>}
      </div>
      <div style={S_PRED_REASONING}>{p.reasoning}</div>
      <div style={S_CAPTION_MUTED_MT4}>{formatTimestamp(p.createdAt)}</div>
    </div>
  )
})

function EvolutionTab({ agentId }: { agentId: string }) {
  const { data, err, loading } = useFetch(() => getAgentEvolution(agentId), [agentId])

  /* T58: memoize reversed list */
  const items = useMemo(
    () => (data?.items ?? []).slice().reverse(),
    [data],
  )

  if (loading) return <SkeletonRows count={4} />
  if (err) return <Hint color={accents.red}>{err}</Hint>
  if (!items.length) return <Hint>No evolutions yet — the agent evolves after sleeping on resolved matches.</Hint>
  return (
    <div>
      {items.map((ev, i) => <EvolutionRow key={`${ev.createdAt}:${i}`} ev={ev} />)}
    </div>
  )
}

/* T58: memo + internal useMemo for expensive story computation */
const EvolutionRow = memo(function EvolutionRow({ ev }: { ev: EvolutionItem }) {
  const story = useMemo(() => buildEvolutionStory(ev), [ev])
  const diff = useMemo(() => Object.entries(ev.parameterDiff ?? {}), [ev])

  return (
    <div style={CARD}>
      <div style={S_EVO_HEADLINE}>{story.headline}</div>
      <div style={S_BODY_MT4}>{story.narrative}</div>
      {ev.summary && ev.summary !== story.narrative && (
        <div style={S_CAPTION_MUTED_MT4}>{ev.summary}</div>
      )}
      {diff.length > 0 && (
        <div style={S_EVO_DIFF_BLOCK}>
          {diff.map(([k, v]) => (
            <div key={k} style={{ color: v >= 0 ? accents.green : accents.red }}>
              {k}: {v >= 0 ? '+' : ''}{v.toFixed(3)}
            </div>
          ))}
        </div>
      )}
      <div style={S_CAPTION_MUTED_MT4}>{formatTimestamp(ev.createdAt)}</div>
    </div>
  )
})

/**
 * T36: "Day 1 vs Day N" — the demo money-shot panel.
 * Side-by-side comparison of where the agent started vs where it is now,
 * with Brier improvement and a human-readable summary.
 */
function BeforeAfterTab({ agentId }: { agentId: string }) {
  const { data, err, loading } = useFetch(async () => {
    const [paramsRes, evoRes, predRes] = await Promise.all([
      getAgentParams(agentId),
      getAgentEvolution(agentId),
      getAgentPredictions(agentId),
    ])
    return buildBeforeAfterDiff(
      agentId,
      paramsRes.params,
      evoRes.items ?? [],
      predRes.items ?? [],
    )
  }, [agentId])

  if (loading) return <Skeleton variant="block" height={120} />
  if (err) return <Hint color={accents.red}>{err}</Hint>
  if (!data) return <Hint>No data available.</Hint>
  const diff = data as BeforeAfterDiff

  if (diff.evolutionCount === 0) {
    return <Hint>{diff.summary}</Hint>
  }

  const brierDeltaColor = diff.brierDelta !== null
    ? (diff.brierDelta < -0.005 ? accents.green : diff.brierDelta > 0.005 ? accents.red : text.muted)
    : text.muted

  return (
    <div>
      {/* Summary card */}
      <div style={CARD_GOLD}>
        <SectionLabel>Day 1 → Day {diff.paramsVersion > 0 ? diff.paramsVersion : 'N'}</SectionLabel>
        <div style={S_BODY_MT6}>{diff.summary}</div>
      </div>

      {/* Brier delta card */}
      {diff.brierDelta !== null && (
        <div style={CARD}>
          <SectionLabel>Accuracy change (Brier score)</SectionLabel>
          <div style={S_BRIER_ROW}>
            <div style={{ textAlign: 'center' }}>
              <div style={S_BRIER_LABEL}>Early</div>
              <div style={S_BRIER_VALUE}>{diff.brierEarly!.toFixed(3)}</div>
            </div>
            <div style={S_BRIER_ARROW}>→</div>
            <div style={{ textAlign: 'center' }}>
              <div style={S_BRIER_LABEL}>Late</div>
              <div style={S_BRIER_VALUE}>{diff.brierLate!.toFixed(3)}</div>
            </div>
            <div style={{
              marginLeft: 'auto', ...typo.body, fontWeight: 700,
              color: brierDeltaColor,
            }}>
              {diff.brierDelta < 0 ? '' : '+'}{diff.brierDelta.toFixed(3)}
              {diff.brierDelta < -0.005 && ' ▼'}
              {diff.brierDelta > 0.005 && ' ▲'}
            </div>
          </div>
          <div style={S_CAPTION_MUTED_MT4}>
            Lower Brier = better calibration. Negative delta = improvement.
          </div>
        </div>
      )}

      {/* Parameter diff table */}
      <div style={CARD}>
        <SectionLabel>Parameter changes</SectionLabel>
        <div style={{ marginTop: 8 }}>
          <div style={S_DIFF_GRID_HEADER}>
            <span>Param</span>
            <span style={S_RIGHT_MUTED}>Day 1</span>
            <span style={S_RIGHT_MUTED}>Now</span>
            <span style={S_RIGHT_MUTED}>Delta</span>
          </div>
          {diff.diffs.map((d: ParamDiffEntry) => (
            <div key={d.key} style={S_DIFF_GRID_ROW}>
              <span style={S_DIFF_LABEL}>{d.label}</span>
              <span style={S_RIGHT_MUTED}>{d.day1.toFixed(2)}</span>
              <span style={S_RIGHT_PAPER}>{d.dayN.toFixed(2)}</span>
              <span style={{
                textAlign: 'right', fontWeight: 700,
                color: d.direction === 'up' ? accents.green : d.direction === 'down' ? accents.red : text.muted,
              }}>
                {d.delta >= 0 ? '+' : ''}{d.delta.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Evolution count */}
      <div style={S_EVO_COUNT}>
        {diff.evolutionCount} evolution event{diff.evolutionCount === 1 ? '' : 's'} · params v{diff.paramsVersion}
      </div>
    </div>
  )
}

function MemoryTab({ agentId }: { agentId: string }) {
  const { data, err, loading } = useFetch(() => getAgentParams(agentId), [agentId])
  if (loading) return <Skeleton variant="text" lines={3} />
  if (err) return <Hint color={accents.red}>{err}</Hint>
  const params = data?.params
  if (!params) return <Hint>No persisted memory yet — first sleep cycle pending.</Hint>
  const topics = Object.entries(params.topicCalibration ?? {})
  return (
    <div>
      <div style={CARD}>
        <div style={S_DATASM_MUTED}>Current parameters (persisted on Walrus Memory)</div>
        <div style={S_BODY_MT6}>Version <b>v{params.version}</b></div>
        <ParamBar label="confidence bias" value={params.confidenceBias} range={0.3} />
        <ParamBar label="hedging level" value={params.hedgingLevel} range={1} />
        {topics.length > 0 && (
          <>
            <div style={S_TOPIC_LABEL}>Topic calibration</div>
            {topics.map(([k, v]) => <ParamBar key={k} label={k} value={v} range={0.3} />)}
          </>
        )}
        {params.updatedAt && (
          <div style={S_CAPTION_MUTED_MT8}>updated {formatTimestamp(params.updatedAt)}</div>
        )}
      </div>
      <Hint>
        Memory lives on Walrus mainnet (MemWal). Each sleep cycle reflects on resolved
        predictions and commits a new version; the diff history is on the Evolution tab.
      </Hint>
    </div>
  )
}

/* T58: memo — label/value/range are primitives, skips re-renders when parent list doesn't change */
const ParamBar = memo(function ParamBar({ label, value, range }: { label: string; value: number; range: number }) {
  const pct = Math.max(-1, Math.min(1, value / range))
  const half = Math.abs(pct) * 50
  return (
    <div style={S_PARAM_BAR_ROW}>
      <span style={S_PARAM_BAR_LABEL}>{label}</span>
      <div
        style={S_PARAM_BAR_TRACK}
        role="meter"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={-range}
        aria-valuemax={range}
      >
        <div style={{
          position: 'absolute', top: 0, height: '100%',
          left: pct >= 0 ? '50%' : `${50 - half}%`, width: `${half}%`,
          background: pct >= 0 ? accents.gold : accents.red,
        }} />
        <div style={S_PARAM_BAR_CENTER} />
      </div>
      <span style={S_PARAM_BAR_VALUE}>{value >= 0 ? '+' : ''}{value.toFixed(3)}</span>
    </div>
  )
})

// ── UI helpers ──────────────────────────────────────────────────────────────

const Hint = memo(function Hint({ children, color = text.muted }: { children: React.ReactNode; color?: string }) {
  return <div style={{ ...typo.dataSm, color, marginTop: 8 }}>{children}</div>
})
