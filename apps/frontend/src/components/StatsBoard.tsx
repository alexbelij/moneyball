/**
 * StatsBoard | v0.2.0 | 2026-06-13
 * Purpose: Scouts' leaderboard — per-agent record/accuracy/streak computed
 * client-side from the public predictions feed (no extra backend endpoint).
 * T15: embeds StatsReport (predictions table + Brier chart) below leaderboard.
 */

import React, { useEffect, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { getAgentPredictions, type PredictionItem } from '@/lib/api'
import { StatsReport } from '@/components/StatsReport'

interface Row {
  agentId: string
  name: string
  total: number
  resolved: number
  correct: number
  /** Positive = win streak, negative = loss streak (by resolvedAt order). */
  streak: number
}

function computeRow(agentId: string, name: string, items: PredictionItem[]): Row {
  const resolved = items
    .filter((p) => p.outcome)
    .sort((a, b) => a.outcome!.resolvedAt.localeCompare(b.outcome!.resolvedAt))
  let streak = 0
  for (let i = resolved.length - 1; i >= 0; i--) {
    const ok = resolved[i].outcome!.correct
    if (streak === 0) streak = ok ? 1 : -1
    else if (ok && streak > 0) streak++
    else if (!ok && streak < 0) streak--
    else break
  }
  return {
    agentId,
    name,
    total: items.length,
    resolved: resolved.length,
    correct: resolved.filter((p) => p.outcome!.correct).length,
    streak,
  }
}

export function StatsBoard({ onClose }: { onClose: () => void }) {
  const agents = useGameStore((s) => s.agents)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const list = Object.values(agents)
    Promise.all(
      list.map(async (a) => {
        const r = await getAgentPredictions(a.agentId)
        return computeRow(a.agentId, a.name, r.items)
      }),
    ).then(
      (rs) => {
        if (!alive) return
        // Rank: accuracy desc (resolved>0 first), then resolved desc.
        rs.sort((a, b) => {
          const accA = a.resolved ? a.correct / a.resolved : -1
          const accB = b.resolved ? b.correct / b.resolved : -1
          return accB - accA || b.resolved - a.resolved
        })
        setRows(rs)
      },
      (e: any) => alive && setErr(e?.message ?? String(e)),
    )
    return () => { alive = false }
  }, [agents])

  return (
    <div style={{
      position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
      zIndex: 65, width: 520, maxWidth: '92vw',
      background: '#111827', border: '1px solid #374151', borderRadius: 10,
      padding: 14, color: '#e5e7eb', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>🏆 Scout Leaderboard</div>
        <button onClick={onClose} aria-label="Close leaderboard" style={{ background: 'none', border: 0, color: '#9ca3af', fontSize: 16, cursor: 'pointer' }}>✕</button>
      </div>

      {err && <div style={{ marginTop: 10, color: '#fca5a5', fontSize: 12 }}>{err}</div>}
      {!rows && !err && <div style={{ marginTop: 10, color: '#9ca3af', fontSize: 12 }}>Crunching the numbers…</div>}

      {rows && (
        <table style={{ marginTop: 10, width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: '#9ca3af', textAlign: 'left' }}>
              <th style={th()}>#</th>
              <th style={th()}>Scout</th>
              <th style={th()}>Record</th>
              <th style={th()}>Accuracy</th>
              <th style={th()}>Streak</th>
              <th style={th()}>Pending</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const acc = r.resolved ? Math.round((r.correct / r.resolved) * 100) : null
              return (
                <tr
                  key={r.agentId}
                  onClick={() => useGameStore.getState().selectAgent(r.agentId)}
                  style={{ borderTop: '1px solid #1f2937', cursor: 'pointer' }}
                >
                  <td style={td()}>{i + 1}</td>
                  <td style={{ ...td(), fontWeight: 600 }}>{r.name}</td>
                  <td style={td()}>{r.correct}–{r.resolved - r.correct}</td>
                  <td style={td()}>{acc === null ? '—' : `${acc}%`}</td>
                  <td style={{ ...td(), color: r.streak > 0 ? '#34d399' : r.streak < 0 ? '#f87171' : '#9ca3af' }}>
                    {r.streak === 0 ? '—' : r.streak > 0 ? `W${r.streak}` : `L${-r.streak}`}
                  </td>
                  <td style={td()}>{r.total - r.resolved}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <div style={{ marginTop: 8, fontSize: 10, color: '#6b7280' }}>
        Click a scout to open their dossier. Records update as WC2026 matches finish.
      </div>

      {/* T15: Detailed predictions + Brier chart */}
      <div style={{ marginTop: 14 }}>
        <StatsReport />
      </div>
    </div>
  )
}

function th() { return { padding: '4px 6px' } as const }
function td() { return { padding: '6px 6px' } as const }
