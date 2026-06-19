/**
 * StatsBoard | v0.5.0 | 2026-06-14
 * Purpose: Scouts' leaderboard — per-agent record/accuracy/streak computed
 * client-side from the public predictions feed (no extra backend endpoint).
 * T49: typography scale — header ≥10px, body ≥16px; responsive layout.
 * T34: pixel reskin — paper leaderboard panel, wood-ramp rows, SNES header,
 *      pixel-medal rank, PixelButton "CLOSE" (no emoji icons).
 * T33: migrated to shared tokens.
 * T15: embeds StatsReport (predictions table + Brier chart) below leaderboard.
 */

import React, { useEffect, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { getAgentPredictions, type PredictionItem } from '@/lib/api'
import { StatsReport } from '@/components/StatsReport'
import { PixelButton, RankMedal, SkeletonRows } from '@/components/ui'
import { palette, accents, text, fonts, borders, shadows, zIndex, type as typo } from '@/styles/tokens'

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
      position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)',
      zIndex: zIndex.stats, width: 680, maxWidth: '96vw',
      maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
      background: palette.wood900, border: borders.standard, borderRadius: 0,
      padding: 14, color: palette.paper, boxShadow: shadows.hard,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ ...typo.hdrSm, fontWeight: 700, fontFamily: fonts.header, letterSpacing: '-0.5px', color: accents.gold }}>SCOUT LEADERBOARD</div>
        <PixelButton size="small" onClick={onClose} aria-label="Close leaderboard">CLOSE</PixelButton>
      </div>

      {err && <div style={{ marginTop: 10, color: accents.red, ...typo.body, fontFamily: fonts.body }}>{err}</div>}
      {!rows && !err && <div style={{ marginTop: 10 }}><SkeletonRows count={5} /></div>}

      {rows && (
        /* Paper leaderboard panel */
        <div style={{
          marginTop: 10, background: palette.paper, color: palette.wood900,
          border: borders.standard, borderRadius: 0, boxShadow: shadows.hardSmall,
          overflowX: 'auto',
        }}>
          <table style={{ width: '100%', minWidth: 380, ...typo.data, borderCollapse: 'collapse', fontFamily: fonts.body }}>
            <thead>
              <tr style={{ background: palette.wood700, color: palette.paper, textAlign: 'left' }}>
                <th style={thHead()}>#</th>
                <th style={thHead()}>Scout</th>
                <th style={thHead()}>Record</th>
                <th style={thHead()}>Accuracy</th>
                <th style={thHead()}>Streak</th>
                <th style={thHead()}>Pending</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const acc = r.resolved ? Math.round((r.correct / r.resolved) * 100) : null
                return (
                  <tr
                    key={r.agentId}
                    onClick={() => useGameStore.getState().selectAgent(r.agentId)}
                    style={{
                      // Wood-ramp striping over the paper panel (token-only).
                      background: i % 2 === 0 ? palette.paperBright : palette.paper,
                      borderTop: i === 0 ? 'none' : borders.rule,
                      cursor: 'pointer',
                    }}
                  >
                    <td style={td()}><RankMedal rank={i + 1} /></td>
                    <td style={{ ...td(), fontWeight: 700, color: palette.wood900 }}>{r.name}</td>
                    <td style={td()}>{r.correct}–{r.resolved - r.correct}</td>
                    <td style={td()}>{acc === null ? '—' : `${acc}%`}</td>
                    <td style={td()}><StreakChip streak={r.streak} /></td>
                    <td style={td()}>{r.total - r.resolved}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: 8, ...typo.caption, color: text.faint, fontFamily: fonts.body }}>
        Click a scout to open their dossier. Records update as WC2026 matches finish.
      </div>

      {/* T15: Detailed predictions + Brier chart */}
      <div style={{ marginTop: 14 }}>
        <StatsReport />
      </div>
    </div>
  )
}

/** Win/loss streak as a pixel chip — guaranteed contrast on the paper panel. */
function StreakChip({ streak }: { streak: number }) {
  if (streak === 0) return <span style={{ color: palette.wood500 }}>—</span>
  const win = streak > 0
  return (
    <span style={{
      display: 'inline-block', padding: '1px 5px',
      fontFamily: fonts.header, ...typo.hdrXs,
      background: win ? accents.green : accents.red,
      color: win ? palette.wood900 : palette.paper,
      border: `2px solid ${palette.wood900}`, boxShadow: shadows.hardSmall,
    }}>
      {win ? `W${streak}` : `L${-streak}`}
    </span>
  )
}

function thHead() {
  return {
    padding: '6px 8px', fontFamily: fonts.header, ...typo.hdrXs,
    letterSpacing: '-0.5px', textTransform: 'uppercase' as const, fontWeight: 400,
  } as const
}
function td() { return { padding: '7px 8px', verticalAlign: 'middle' } as const }
