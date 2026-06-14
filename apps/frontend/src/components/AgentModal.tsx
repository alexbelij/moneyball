/**
 * AgentModal | v0.10.0 | 2026-06-14
 * Purpose: Agent dossier — Overview (actions) + Method / Predictions /
 * Evolution / Before/After / Memory tabs. WAI-ARIA dialog + tabs, focus trap.
 * T14: refactored to use PixelButton + design-spec palette.
 * T35: scrim backdrop uses semantic `overlay` token.
 * T33: migrated to shared tokens (fixed wrong wood-700/500 values).
 * T26: added Method tab surfacing each agent's methodology from agent-config.
 * T27: Predictions tab now shows a per-agent rolling-Brier performance chart.
 * T28: Evolution tab renders a deterministic human-readable story per event.
 * T30: Method tab discloses honest model-input provenance (synthetic v1).
 * T36: "Day 1 vs Day N" before/after comparison panel — the demo money-shot.
 */

import React, { useEffect, useState } from 'react'
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
import { AgentPerfChart } from '@/components/AgentPerfChart'
import { buildAgentPerfSeries } from '@/lib/agentPerf'
import { buildEvolutionStory } from '@/lib/evolutionStory'
import { palette, accents, text, fonts, borders, shadows, zIndex, overlay } from '@/styles/tokens'

type Tab = 'overview' | 'method' | 'predictions' | 'evolution' | 'before-after' | 'memory'
const TABS: readonly Tab[] = ['overview', 'method', 'predictions', 'evolution', 'before-after', 'memory'] as const
const MODAL_TITLE_ID = 'agent-modal-title'

export function AgentModal() {
  const selected = useGameStore((s) => s.ui.selectedAgentId)
  const agent = useGameStore((s) => (selected ? s.agents[selected] : null))
  const close = () => useGameStore.getState().selectAgent(null)

  const viewer = useAuthStore((s) => s.viewer)
  const isAdmin = viewer?.role === 'admin'

  const [tab, setTab] = useState<Tab>('overview')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const trapRef = useFocusTrap<HTMLDivElement>({ onClose: close, active: !!agent })
  const { getTabProps, getTabPanelProps, getTabListProps } = useRovingTabs({
    tabs: TABS,
    activeTab: tab,
    onSelect: setTab,
  })

  useEffect(() => { setTab('overview'); setErr(null) }, [selected])

  if (!agent) return null
  const agentId = agent.agentId

  async function onRoast() {
    setErr(null); setBusy(true)
    try {
      const r = await roast(agentId)
      GameEventBus.emit('thought:show', { agentId, text: r.text, duration: 3500 })
    } catch (e: any) {
      setErr(e.message ?? String(e))
    } finally { setBusy(false) }
  }

  async function onDisagree() {
    setErr(null); setBusy(true)
    try {
      await disagree(agentId)
      const r = await roast(agentId)
      GameEventBus.emit('thought:show', { agentId, text: r.text, duration: 3500 })
    } catch (e: any) {
      setErr(e.message ?? String(e))
    } finally { setBusy(false) }
  }

  async function onSimulateDayPlusOne() {
    setErr(null); setBusy(true)
    try {
      await adminDayPlusOne(agentId)
      const r = await roast(agentId)
      GameEventBus.emit('thought:show', { agentId, text: `[Day+1] ${r.text}`, duration: 4000 })
    } catch (e: any) {
      setErr('Admin action failed (requires admin role).')
    } finally { setBusy(false) }
  }

  return (
    <div
      onClick={close}
      style={{
        position: 'absolute', inset: 0,
        background: overlay,
        display: 'flex', justifyContent: 'flex-end',
        zIndex: zIndex.modal,
      }}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={MODAL_TITLE_ID}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440, height: '100%',
          background: palette.wood900,
          borderLeft: borders.standard,
          padding: 16, color: palette.paper,
          fontFamily: fonts.body,
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <div
              id={MODAL_TITLE_ID}
              style={{ fontSize: 12, fontWeight: 700, fontFamily: fonts.header, color: accents.gold, letterSpacing: '-0.5px' }}
            >
              {agent.name}
            </div>
            <div style={{ fontSize: 16, color: text.muted, marginTop: 2 }}>{agent.role}</div>
            <div style={{ marginTop: 8, fontSize: 14, color: text.dim }}>
              Status: <b>{agent.status}</b>
            </div>
          </div>
          <PixelButton variant="ghost" size="small" onClick={close} aria-label="Close agent modal">
            ✕
          </PixelButton>
        </div>

        {/* Tabs */}
        <div style={{ marginTop: 14, display: 'flex', gap: 4, flexWrap: 'wrap' }} {...getTabListProps()}>
          {TABS.map((t) => (
            <PixelButton
              key={t}
              variant={tab === t ? 'primary' : 'default'}
              size="small"
              onClick={() => setTab(t)}
              {...getTabProps(t)}
              style={{ textTransform: t === 'before-after' ? 'none' : 'capitalize', fontSize: 12 }}
            >
              {t === 'before-after' ? 'Day1 vs Now' : t}
            </PixelButton>
          ))}
        </div>

        {/* Tab panel */}
        <div style={{ marginTop: 12, flex: 1, overflowY: 'auto', minHeight: 0 }} {...getTabPanelProps(tab)}>
          {tab === 'overview' && (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <PixelButton disabled={busy} onClick={onRoast}>Roast me</PixelButton>
                <PixelButton disabled={busy} onClick={onDisagree} variant="danger">
                  Disagree
                </PixelButton>
                {isAdmin && (
                  <PixelButton disabled={busy} onClick={onSimulateDayPlusOne} variant="primary">
                    Simulate Day +1
                  </PixelButton>
                )}
              </div>
              {err && <div role="alert" style={{ marginTop: 10, color: accents.red, fontSize: 14 }}>{err}</div>}
              <div style={{ marginTop: 16, fontSize: 14, color: text.muted }}>Last thought:</div>
              <div style={{ marginTop: 6, fontSize: 15 }}>{agent.lastThought ?? '—'}</div>
            </>
          )}
          {tab === 'method' && <MethodTab agentId={agentId} />}
          {tab === 'predictions' && <PredictionsTab agentId={agentId} />}
          {tab === 'evolution' && <EvolutionTab agentId={agentId} />}
          {tab === 'before-after' && <BeforeAfterTab agentId={agentId} />}
          {tab === 'memory' && <MemoryTab agentId={agentId} />}
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: text.muted, borderTop: borders.standard, paddingTop: 8 }}>
          Identity: {viewer ? `Sui (${viewer.role})` : 'Guest'}
        </div>
      </div>
    </div>
  )
}

// ── Tabs ────────────────────────────────────────────────────────────────────

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

export function MethodTab({ agentId }: { agentId: string }) {
  const { data, err, loading } = useFetch(() => getAgentProfile(agentId), [agentId])
  if (loading) return <Hint>Loading methodology…</Hint>
  if (err) return <Hint color={accents.red}>{err}</Hint>
  const profile = data?.profile as AgentProfile | undefined
  if (!profile) return <Hint>No profile available.</Hint>

  const m = profile.methodology
  const params = Object.entries(m.parameters ?? {})

  return (
    <div>
      {/* Personality */}
      <div style={card()}>
        <SectionLabel>Approach</SectionLabel>
        <div style={{ fontSize: 15, marginTop: 4 }}>{profile.personality}</div>
        <div style={{ marginTop: 8, fontSize: 12, color: text.muted }}>
          model: <b style={{ color: accents.gold }}>{m.type}</b>
        </div>
      </div>

      {/* Catchphrases */}
      {profile.catchphrases.length > 0 && (
        <div style={card()}>
          <SectionLabel>Catchphrases</SectionLabel>
          {profile.catchphrases.map((c, i) => (
            <div key={i} style={{ fontSize: 15, marginTop: 4, color: text.dim, fontStyle: 'italic' }}>
              “{c}”
            </div>
          ))}
        </div>
      )}

      {/* Formula (weighted/EV/contrarian agents) */}
      {m.formula && (
        <div style={card()}>
          <SectionLabel>Scoring formula</SectionLabel>
          <pre
            style={{
              margin: '6px 0 0', padding: 8,
              background: palette.surface, border: borders.rule, borderRadius: 0,
              fontSize: 13, color: accents.green, fontFamily: 'monospace',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}
          >
            {m.formula}
          </pre>
        </div>
      )}

      {/* Rule list (Madame Pythia / deterministic mysticism) */}
      {m.rules.length > 0 && (
        <div style={card()}>
          <SectionLabel>Rules</SectionLabel>
          {m.description && (
            <div style={{ fontSize: 13, color: text.muted, marginTop: 4 }}>{m.description}</div>
          )}
          {m.rules.map((r, i) => (
            <div
              key={i}
              style={{ marginTop: 8, paddingTop: 8, borderTop: i === 0 ? 'none' : borders.rule }}
            >
              <div style={{ fontSize: 14, color: accents.gold, fontWeight: 700 }}>{r.name}</div>
              <div style={{ fontSize: 13, color: text.dim, marginTop: 2 }}>{r.logic}</div>
              <div style={{ fontSize: 13, color: accents.green, marginTop: 2, fontFamily: 'monospace' }}>
                → {r.effect}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Parameters */}
      {params.length > 0 && (
        <div style={card()}>
          <SectionLabel>Parameters</SectionLabel>
          <div style={{ marginTop: 4 }}>
            {params.map(([k, v]) => (
              <div
                key={k}
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontFamily: 'monospace', marginTop: 2 }}
              >
                <span style={{ color: text.muted }}>{k}</span>
                <span style={{ color: palette.paper }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evolution trigger */}
      {m.evolutionTrigger && (
        <div style={card()}>
          <SectionLabel>How it evolves</SectionLabel>
          <div style={{ fontSize: 14, marginTop: 4, color: text.dim }}>{m.evolutionTrigger}</div>
        </div>
      )}

      {/* T30: honest data-source disclosure */}
      <DataInputsCard />
    </div>
  )
}

/**
 * T30: honest disclosure of what the prediction engine actually runs on. The
 * agents narrate "xG model: …" but the numbers are synthetic placeholders — we
 * say so plainly here so users/judges are never misled.
 */
export function DataInputsCard() {
  const { data, err, loading } = useFetch(() => getDataSource(), [])
  if (loading || err || !data) return null
  return (
    <div style={card()}>
      <SectionLabel>Data inputs</SectionLabel>
      <div style={{
        fontSize: 13, color: accents.gold, marginTop: 4, display: 'flex',
        alignItems: 'center', gap: 6,
      }}>
        <SourceBadge source="synthetic" />
        <span>{data.headline}</span>
      </div>
      <div style={{ marginTop: 8 }}>
        {data.inputs.map((inp) => (
          <div key={inp.key} style={{
            marginTop: 8, paddingTop: 8,
            borderTop: borders.rule,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <SourceBadge source={inp.source} />
              <span style={{ fontSize: 14, color: palette.paper }}>{inp.label}</span>
            </div>
            <div style={{ fontSize: 13, color: text.muted, marginTop: 2 }}>{inp.detail}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SourceBadge({ source }: { source: 'synthetic' | 'manual' | 'live' }) {
  const color = source === 'live' ? accents.green : source === 'manual' ? text.dim : accents.red
  return (
    <span style={{
      fontSize: 10, fontFamily: fonts.header, letterSpacing: '-0.5px',
      textTransform: 'uppercase', color: palette.wood900,
      background: color, padding: '2px 5px', border: borders.rule,
      whiteSpace: 'nowrap',
    }}>
      {source}
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11, fontFamily: fonts.header, color: text.muted,
        letterSpacing: '-0.5px', textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  )
}

function PredictionsTab({ agentId }: { agentId: string }) {
  const { data, err, loading } = useFetch(() => getAgentPredictions(agentId), [agentId])
  if (loading) return <Hint>Loading predictions…</Hint>
  if (err) return <Hint color={accents.red}>{err}</Hint>
  const raw = data?.items ?? []
  const items = raw.slice().reverse()
  if (!items.length) return <Hint>No predictions yet — waiting for the next fixture window.</Hint>

  const resolved = items.filter((p) => p.outcome)
  const correct = resolved.filter((p) => p.outcome!.correct).length
  // T27: per-agent performance chart from this agent's resolved predictions.
  const perf = buildAgentPerfSeries(agentId, raw)
  return (
    <div>
      {perf.resolvedCount >= 2 ? (
        <AgentPerfChart series={perf} />
      ) : (
        <div style={{
          fontSize: 13, color: text.muted, border: borders.standard,
          background: palette.surface, padding: 10, marginBottom: 8, textAlign: 'center',
        }}>
          Need ≥2 resolved matches to chart this scout's accuracy.
        </div>
      )}
      <div style={{ fontSize: 14, color: text.muted, marginBottom: 8 }}>
        Record: <b style={{ color: palette.paper }}>{correct}/{resolved.length}</b> resolved · {items.length} total
      </div>
      {items.map((p) => <PredictionRow key={p.predictionId ?? `${p.matchId}:${p.createdAt}`} p={p} />)}
    </div>
  )
}

function PredictionRow({ p }: { p: PredictionItem }) {
  const badge = p.outcome ? (p.outcome.correct ? '✓' : '✗') : '…'
  const badgeColor = p.outcome ? (p.outcome.correct ? accents.green : accents.red) : text.muted
  return (
    <div style={card()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
        <span style={{ color: text.dim }}>{p.matchId}</span>
        <span style={{ color: badgeColor, fontWeight: 700 }} aria-label={p.outcome ? (p.outcome.correct ? 'Correct' : 'Incorrect') : 'Pending'}>{badge}</span>
      </div>
      <div style={{ marginTop: 4, fontSize: 15 }}>
        Pick <b>{p.pick}</b> · confidence <b>{Math.round(p.confidence * 100)}%</b>
        {typeof p.paramsVersion === 'number' && <span style={{ color: text.muted }}> · params v{p.paramsVersion}</span>}
      </div>
      <div style={{ marginTop: 4, fontSize: 14, color: text.muted }}>{p.reasoning}</div>
      <div style={{ marginTop: 4, fontSize: 12, color: text.muted }}>{new Date(p.createdAt).toLocaleString()}</div>
    </div>
  )
}

function EvolutionTab({ agentId }: { agentId: string }) {
  const { data, err, loading } = useFetch(() => getAgentEvolution(agentId), [agentId])
  if (loading) return <Hint>Loading evolution history…</Hint>
  if (err) return <Hint color={accents.red}>{err}</Hint>
  const items = (data?.items ?? []).slice().reverse()
  if (!items.length) return <Hint>No evolutions yet — the agent evolves after sleeping on resolved matches.</Hint>
  return (
    <div>
      {items.map((ev, i) => <EvolutionRow key={`${ev.createdAt}:${i}`} ev={ev} />)}
    </div>
  )
}

function EvolutionRow({ ev }: { ev: EvolutionItem }) {
  // T28: deterministic, human-readable story derived from the event deltas.
  const story = buildEvolutionStory(ev)
  const diff = Object.entries(ev.parameterDiff ?? {})
  return (
    <div style={card()}>
      <div style={{ fontSize: 14, color: accents.gold, fontWeight: 700 }}>{story.headline}</div>
      {/* Human-readable narrative */}
      <div style={{ marginTop: 4, fontSize: 15 }}>{story.narrative}</div>
      {/* Original engine summary, if it differs from the narrative */}
      {ev.summary && ev.summary !== story.narrative && (
        <div style={{ marginTop: 4, fontSize: 13, color: text.muted }}>{ev.summary}</div>
      )}
      {diff.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 13, fontFamily: 'monospace' }}>
          {diff.map(([k, v]) => (
            <div key={k} style={{ color: v >= 0 ? accents.green : accents.red }}>
              {k}: {v >= 0 ? '+' : ''}{v.toFixed(3)}
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 4, fontSize: 12, color: text.muted }}>{new Date(ev.createdAt).toLocaleString()}</div>
    </div>
  )
}

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

  if (loading) return <Hint>Computing before/after diff…</Hint>
  if (err) return <Hint color={accents.red}>{err}</Hint>
  if (!data) return <Hint>No data available.</Hint>
  const diff = data as BeforeAfterDiff

  if (diff.evolutionCount === 0) {
    return <Hint>{diff.summary}</Hint>
  }

  return (
    <div>
      {/* Summary card */}
      <div style={{
        ...card(),
        borderColor: accents.gold,
        borderWidth: 2,
      }}>
        <SectionLabel>Day 1 → Day {diff.paramsVersion > 0 ? diff.paramsVersion : 'N'}</SectionLabel>
        <div style={{ fontSize: 15, marginTop: 6, lineHeight: 1.5 }}>
          {diff.summary}
        </div>
      </div>

      {/* Brier delta card */}
      {diff.brierDelta !== null && (
        <div style={card()}>
          <SectionLabel>Accuracy change (Brier score)</SectionLabel>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            marginTop: 8, fontSize: 15, fontFamily: 'monospace',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: text.muted }}>Early</div>
              <div style={{ fontSize: 18, color: text.dim }}>{diff.brierEarly!.toFixed(3)}</div>
            </div>
            <div style={{ fontSize: 20, color: text.muted }}>→</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: text.muted }}>Late</div>
              <div style={{ fontSize: 18, color: text.dim }}>{diff.brierLate!.toFixed(3)}</div>
            </div>
            <div style={{
              marginLeft: 'auto',
              fontSize: 16,
              fontWeight: 700,
              color: diff.brierDelta < -0.005 ? accents.green : diff.brierDelta > 0.005 ? accents.red : text.muted,
            }}>
              {diff.brierDelta < 0 ? '' : '+'}{diff.brierDelta.toFixed(3)}
              {diff.brierDelta < -0.005 && ' ▼'}
              {diff.brierDelta > 0.005 && ' ▲'}
            </div>
          </div>
          <div style={{ fontSize: 12, color: text.muted, marginTop: 4 }}>
            Lower Brier = better calibration. Negative delta = improvement.
          </div>
        </div>
      )}

      {/* Parameter diff table */}
      <div style={card()}>
        <SectionLabel>Parameter changes</SectionLabel>
        <div style={{ marginTop: 8 }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 60px 60px 70px',
            fontSize: 11, color: text.muted, fontFamily: 'monospace',
            paddingBottom: 4, borderBottom: borders.rule,
          }}>
            <span>Param</span>
            <span style={{ textAlign: 'right' }}>Day 1</span>
            <span style={{ textAlign: 'right' }}>Now</span>
            <span style={{ textAlign: 'right' }}>Delta</span>
          </div>
          {diff.diffs.map((d: ParamDiffEntry) => (
            <div
              key={d.key}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 60px 60px 70px',
                fontSize: 13, fontFamily: 'monospace',
                padding: '4px 0',
                borderBottom: borders.rule,
              }}
            >
              <span style={{ color: text.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.label}
              </span>
              <span style={{ textAlign: 'right', color: text.muted }}>{d.day1.toFixed(2)}</span>
              <span style={{ textAlign: 'right', color: palette.paper }}>{d.dayN.toFixed(2)}</span>
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
      <div style={{
        fontSize: 12, color: text.muted, marginTop: 4, textAlign: 'center',
      }}>
        {diff.evolutionCount} evolution event{diff.evolutionCount === 1 ? '' : 's'} · params v{diff.paramsVersion}
      </div>
    </div>
  )
}

function MemoryTab({ agentId }: { agentId: string }) {
  const { data, err, loading } = useFetch(() => getAgentParams(agentId), [agentId])
  if (loading) return <Hint>Reading long-term memory…</Hint>
  if (err) return <Hint color={accents.red}>{err}</Hint>
  const params = data?.params
  if (!params) return <Hint>No persisted memory yet — first sleep cycle pending.</Hint>
  const topics = Object.entries(params.topicCalibration ?? {})
  return (
    <div>
      <div style={card()}>
        <div style={{ fontSize: 14, color: text.muted }}>Current parameters (persisted on Walrus Memory)</div>
        <div style={{ marginTop: 6, fontSize: 15 }}>
          Version <b>v{params.version}</b>
        </div>
        <ParamBar label="confidence bias" value={params.confidenceBias} range={0.3} />
        <ParamBar label="hedging level" value={params.hedgingLevel} range={1} />
        {topics.length > 0 && (
          <>
            <div style={{ marginTop: 10, fontSize: 13, color: text.muted }}>Topic calibration</div>
            {topics.map(([k, v]) => <ParamBar key={k} label={k} value={v} range={0.3} />)}
          </>
        )}
        {params.updatedAt && (
          <div style={{ marginTop: 8, fontSize: 12, color: text.muted }}>updated {new Date(params.updatedAt).toLocaleString()}</div>
        )}
      </div>
      <Hint>
        Memory lives on Walrus mainnet (MemWal). Each sleep cycle reflects on resolved
        predictions and commits a new version; the diff history is on the Evolution tab.
      </Hint>
    </div>
  )
}

function ParamBar({ label, value, range }: { label: string; value: number; range: number }) {
  const pct = Math.max(-1, Math.min(1, value / range))
  const half = Math.abs(pct) * 50
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 13, fontFamily: 'monospace' }}>
      <span style={{ width: 120, color: text.muted, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <div
        style={{
          flex: 1, height: 6, background: palette.surface,
          border: borders.rule, borderRadius: 0,
          position: 'relative',
        }}
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
        <div style={{ position: 'absolute', left: '50%', top: -1, width: 1, height: 'calc(100% + 2px)', background: palette.wood700 }} />
      </div>
      <span style={{ width: 52, textAlign: 'right', color: text.dim }}>{value >= 0 ? '+' : ''}{value.toFixed(3)}</span>
    </div>
  )
}

// ── UI helpers ──────────────────────────────────────────────────────────────

function Hint({ children, color = text.muted }: { children: React.ReactNode; color?: string }) {
  return <div style={{ fontSize: 14, color, marginTop: 8 }}>{children}</div>
}

function card() {
  return {
    background: palette.surface,
    border: borders.standard,
    borderRadius: 0,
    padding: 10,
    marginBottom: 8,
    boxShadow: shadows.hardSmall,
  } as const
}
