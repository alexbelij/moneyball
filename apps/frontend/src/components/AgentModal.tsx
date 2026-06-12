/**
 * AgentModal | v0.4.0 | 2026-06-12
 * Purpose: Agent dossier — Overview (actions) + Predictions / Evolution /
 * Memory tabs backed by public agent endpoints. Admin controls need JWT admin.
 */

import React, { useEffect, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import {
  roast, disagree, adminDayPlusOne,
  getAgentPredictions, getAgentEvolution, getAgentParams,
  type PredictionItem, type EvolutionItem,
} from '@/lib/api'
import { GameEventBus } from '@/events/GameEventBus'
import { useAuthStore } from '@/store/authStore'

type Tab = 'overview' | 'predictions' | 'evolution' | 'memory'

export function AgentModal() {
  const selected = useGameStore((s) => s.ui.selectedAgentId)
  const agent = useGameStore((s) => (selected ? s.agents[selected] : null))
  const close = () => useGameStore.getState().selectAgent(null)

  const viewer = useAuthStore((s) => s.viewer)
  const isAdmin = viewer?.role === 'admin'

  const [tab, setTab] = useState<Tab>('overview')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Reset tab when switching agents so each dossier opens on Overview.
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
    } finally {
      setBusy(false)
    }
  }

  async function onDisagree() {
    setErr(null); setBusy(true)
    try {
      await disagree(agentId)
      const r = await roast(agentId)
      GameEventBus.emit('thought:show', { agentId, text: r.text, duration: 3500 })
    } catch (e: any) {
      setErr(e.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  async function onSimulateDayPlusOne() {
    setErr(null); setBusy(true)
    try {
      await adminDayPlusOne(agentId)
      const r = await roast(agentId)
      GameEventBus.emit('thought:show', { agentId, text: `[Day+1] ${r.text}`, duration: 4000 })
    } catch (e: any) {
      setErr('Admin action failed (requires admin role).')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      onClick={close}
      style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'flex-end', zIndex: 70 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440, height: '100%', background: '#111827',
          borderLeft: '1px solid #374151', padding: 16, color: '#e5e7eb',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{agent.name}</div>
            <div style={{ fontSize: 13, color: '#9ca3af' }}>{agent.role}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#d1d5db' }}>
              Status: <b>{agent.status}</b>
            </div>
          </div>
          <button onClick={close} style={{ background: 'none', border: 0, color: '#9ca3af', fontSize: 18, cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 6 }}>
          {(['overview', 'predictions', 'evolution', 'memory'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                ...btn(tab === t ? '#2563eb' : '#374151', tab === t ? 'rgba(37,99,235,0.2)' : '#1f2937', tab === t ? '#93c5fd' : '#e5e7eb'),
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 12, flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {tab === 'overview' && (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button disabled={busy} onClick={onRoast} style={btn()}>Roast me</button>
                <button disabled={busy} onClick={onDisagree} style={btn('#7c2d12', 'rgba(180, 83, 9, 0.15)', '#fdba74')}>
                  Disagree
                </button>
                {isAdmin && (
                  <button disabled={busy} onClick={onSimulateDayPlusOne} style={btn('#1d4ed8', 'rgba(59,130,246,0.15)', '#93c5fd')}>
                    Simulate Day +1 (admin)
                  </button>
                )}
              </div>
              {err && <div style={{ marginTop: 10, color: '#fca5a5', fontSize: 12 }}>{err}</div>}
              <div style={{ marginTop: 16, fontSize: 12, color: '#9ca3af' }}>Last thought:</div>
              <div style={{ marginTop: 6, fontSize: 13 }}>{agent.lastThought ?? '—'}</div>
            </>
          )}
          {tab === 'predictions' && <PredictionsTab agentId={agentId} />}
          {tab === 'evolution' && <EvolutionTab agentId={agentId} />}
          {tab === 'memory' && <MemoryTab agentId={agentId} />}
        </div>

        <div style={{ marginTop: 12, fontSize: 11, color: '#6b7280' }}>
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

function PredictionsTab({ agentId }: { agentId: string }) {
  const { data, err, loading } = useFetch(() => getAgentPredictions(agentId), [agentId])
  if (loading) return <Hint>Loading predictions…</Hint>
  if (err) return <Hint color="#fca5a5">{err}</Hint>
  const items = (data?.items ?? []).slice().reverse() // newest first
  if (!items.length) return <Hint>No predictions yet — waiting for the next fixture window.</Hint>

  const resolved = items.filter((p) => p.outcome)
  const correct = resolved.filter((p) => p.outcome!.correct).length
  return (
    <div>
      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
        Record: <b style={{ color: '#e5e7eb' }}>{correct}/{resolved.length}</b> resolved · {items.length} total
      </div>
      {items.map((p) => <PredictionRow key={p.predictionId ?? `${p.matchId}:${p.createdAt}`} p={p} />)}
    </div>
  )
}

function PredictionRow({ p }: { p: PredictionItem }) {
  const badge = p.outcome ? (p.outcome.correct ? '✓' : '✗') : '…'
  const badgeColor = p.outcome ? (p.outcome.correct ? '#34d399' : '#f87171') : '#9ca3af'
  return (
    <div style={card()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ color: '#d1d5db' }}>{p.matchId}</span>
        <span style={{ color: badgeColor, fontWeight: 700 }}>{badge}</span>
      </div>
      <div style={{ marginTop: 4, fontSize: 13 }}>
        Pick <b>{p.pick}</b> · confidence <b>{Math.round(p.confidence * 100)}%</b>
        {typeof p.paramsVersion === 'number' && <span style={{ color: '#6b7280' }}> · params v{p.paramsVersion}</span>}
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: '#9ca3af' }}>{p.reasoning}</div>
      <div style={{ marginTop: 4, fontSize: 10, color: '#6b7280' }}>{new Date(p.createdAt).toLocaleString()}</div>
    </div>
  )
}

function EvolutionTab({ agentId }: { agentId: string }) {
  const { data, err, loading } = useFetch(() => getAgentEvolution(agentId), [agentId])
  if (loading) return <Hint>Loading evolution history…</Hint>
  if (err) return <Hint color="#fca5a5">{err}</Hint>
  const items = (data?.items ?? []).slice().reverse()
  if (!items.length) return <Hint>No evolutions yet — the agent evolves after sleeping on resolved matches.</Hint>
  return (
    <div>
      {items.map((ev, i) => <EvolutionRow key={`${ev.createdAt}:${i}`} ev={ev} />)}
    </div>
  )
}

function EvolutionRow({ ev }: { ev: EvolutionItem }) {
  const diff = Object.entries(ev.parameterDiff ?? {})
  return (
    <div style={card()}>
      <div style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700 }}>
        {typeof ev.fromVersion === 'number' ? `v${ev.fromVersion} → v${ev.toVersion}` : 'evolution'}
        {ev.evolutionType && <span style={{ color: '#6b7280', fontWeight: 400 }}> · {ev.evolutionType}</span>}
      </div>
      <div style={{ marginTop: 4, fontSize: 13 }}>{ev.summary}</div>
      {diff.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 11, fontFamily: 'monospace' }}>
          {diff.map(([k, v]) => (
            <div key={k} style={{ color: v >= 0 ? '#34d399' : '#f87171' }}>
              {k}: {v >= 0 ? '+' : ''}{v.toFixed(3)}
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 4, fontSize: 10, color: '#6b7280' }}>{new Date(ev.createdAt).toLocaleString()}</div>
    </div>
  )
}

function MemoryTab({ agentId }: { agentId: string }) {
  const { data, err, loading } = useFetch(() => getAgentParams(agentId), [agentId])
  if (loading) return <Hint>Reading long-term memory…</Hint>
  if (err) return <Hint color="#fca5a5">{err}</Hint>
  const params = data?.params
  if (!params) return <Hint>No persisted memory yet — first sleep cycle pending.</Hint>
  const topics = Object.entries(params.topicCalibration ?? {})
  return (
    <div>
      <div style={card()}>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>Current parameters (persisted on Walrus Memory)</div>
        <div style={{ marginTop: 6, fontSize: 13 }}>
          Version <b>v{params.version}</b>
        </div>
        <ParamBar label="confidence bias" value={params.confidenceBias} range={0.3} />
        <ParamBar label="hedging level" value={params.hedgingLevel} range={1} />
        {topics.length > 0 && (
          <>
            <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af' }}>Topic calibration</div>
            {topics.map(([k, v]) => <ParamBar key={k} label={k} value={v} range={0.3} />)}
          </>
        )}
        {params.updatedAt && (
          <div style={{ marginTop: 8, fontSize: 10, color: '#6b7280' }}>updated {new Date(params.updatedAt).toLocaleString()}</div>
        )}
      </div>
      <Hint>
        Memory lives on Walrus mainnet (MemWal). Each sleep cycle reflects on resolved
        predictions and commits a new version; the diff history is on the Evolution tab.
      </Hint>
    </div>
  )
}

/** Signed bar: range maps [-range, +range] → full width; 0 is centered. */
function ParamBar({ label, value, range }: { label: string; value: number; range: number }) {
  const pct = Math.max(-1, Math.min(1, value / range)) // [-1, 1]
  const half = Math.abs(pct) * 50
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, fontFamily: 'monospace' }}>
      <span style={{ width: 120, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: '#1f2937', borderRadius: 3, position: 'relative' }}>
        <div style={{
          position: 'absolute', top: 0, height: 6, borderRadius: 3,
          left: pct >= 0 ? '50%' : `${50 - half}%`, width: `${half}%`,
          background: pct >= 0 ? '#2563eb' : '#d97706',
        }} />
        <div style={{ position: 'absolute', left: '50%', top: -1, width: 1, height: 8, background: '#4b5563' }} />
      </div>
      <span style={{ width: 52, textAlign: 'right' }}>{value >= 0 ? '+' : ''}{value.toFixed(3)}</span>
    </div>
  )
}

// ── UI helpers ──────────────────────────────────────────────────────────────

function Hint({ children, color = '#9ca3af' }: { children: React.ReactNode; color?: string }) {
  return <div style={{ fontSize: 12, color, marginTop: 8 }}>{children}</div>
}

function card() {
  return {
    background: '#1f2937', border: '1px solid #374151', borderRadius: 8,
    padding: 10, marginBottom: 8,
  } as const
}

function btn(border = '#374151', bg = '#1f2937', color = '#e5e7eb') {
  return {
    padding: '8px 10px',
    borderRadius: 8,
    border: `1px solid ${border}`,
    background: bg,
    color,
    cursor: 'pointer',
    fontSize: 12,
  } as const
}
