/**
 * ConsensusView | v1.0.0 | 2026-06-19
 * "5 Agents Vote" visualization — the killer feature.
 * Shows how all 5 agents predict a single match,
 * with visual vote bars and disagreement indicator.
 *
 * Renders as an overlay panel triggered from TacticsBoard match rows.
 */

import React, { useMemo, useState, useEffect } from 'react'
import { palette, accents, text, fonts, type, borders, shadows, spacing, agentColors, overlay, zIndex } from '@/styles/tokens'
import { PixelIcon } from '@/components/icons/PixelIcon'
import { useGameStore } from '@/store/gameStore'
import { getAgentPredictions, type PredictionItem, type MatchInfo } from '@/lib/api'

/* ── Agent metadata ──────────────────────────────────────────────── */
const AGENTS = [
  { id: 'dr_morgan', name: 'Dr. Morgan', method: 'Bayesian Stats' },
  { id: 'scout_alvarez', name: 'Scout Alvarez', method: 'Form Analysis' },
  { id: 'viktor_kane', name: 'Viktor Kane', method: 'Tactical' },
  { id: 'sofia_mendes', name: 'Sofia Mendes', method: 'Market Odds' },
  { id: 'madame_pythia', name: 'Madame Pythia', method: 'Intuition' },
] as const

/** Convert pick string ("1"/"X"/"2") + confidence into bar values */
function pickToBars(pick: string, confidence: number): { home: number; draw: number; away: number } {
  const c = Math.min(Math.max(confidence, 0), 1)
  const remainder = (1 - c) / 2
  if (pick === '1') return { home: c, draw: remainder, away: remainder }
  if (pick === 'X') return { home: remainder, draw: c, away: remainder }
  return { home: remainder, draw: remainder, away: c }
}

interface ConsensusViewProps {
  match: MatchInfo
  onClose: () => void
}

export function ConsensusView({ match, onClose }: ConsensusViewProps) {
  const cachedPredictions = useGameStore((s) => s.predictions)
  const [allPreds, setAllPreds] = useState<PredictionItem[]>([])

  useEffect(() => {
    // Gather predictions from cache for all agents
    const preds: PredictionItem[] = []
    for (const agent of AGENTS) {
      const cached = cachedPredictions[agent.id] ?? []
      const matchPred = cached.find((p) => p.matchId === match.id)
      if (matchPred) preds.push(matchPred)
    }
    setAllPreds(preds)

    // If not all cached, fetch missing
    if (preds.length < AGENTS.length) {
      Promise.allSettled(
        AGENTS.filter((a) => !preds.find((p) => p.agentId === a.id))
          .map((a) => getAgentPredictions(a.id).catch(() => []))
      ).then((results) => {
        const newPreds = [...preds]
        for (const r of results) {
          if (r.status === 'fulfilled') {
            const items = r.value as PredictionItem[]
            const found = items.find((p) => p.matchId === match.id)
            if (found) newPreds.push(found)
          }
        }
        setAllPreds(newPreds)
      })
    }
  }, [match.id, cachedPredictions])

  /** Agent votes */
  const agentVotes = useMemo(() => {
    return AGENTS.map((agent) => {
      const pred = allPreds.find((p) => p.agentId === agent.id)
      const bars = pred ? pickToBars(pred.pick, pred.confidence) : null
      return { ...agent, prediction: pred, bars }
    })
  }, [allPreds])

  /** Consensus: average of all agent votes */
  const consensus = useMemo(() => {
    const withBars = agentVotes.filter((a) => a.bars)
    if (withBars.length === 0) return null
    const home = withBars.reduce((s, a) => s + a.bars!.home, 0) / withBars.length
    const draw = withBars.reduce((s, a) => s + a.bars!.draw, 0) / withBars.length
    const away = withBars.reduce((s, a) => s + a.bars!.away, 0) / withBars.length
    return { home, draw, away }
  }, [agentVotes])

  /** Disagreement level */
  const disagreement = useMemo(() => {
    const picks = agentVotes.filter((a) => a.prediction).map((a) => a.prediction!.pick)
    if (picks.length < 2) return 0
    const unique = new Set(picks).size
    return unique / picks.length // 1.0 = all different, 0.2 = all same
  }, [agentVotes])

  const disagreementLevel = disagreement > 0.6 ? 'HIGH' : disagreement > 0.3 ? 'MED' : 'LOW'
  const disagreementColor = disagreement > 0.6 ? accents.red : disagreement > 0.3 ? accents.gold : accents.green

  return (
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={S.header}>
          <span style={S.headerTitle}>CABINET VOTE</span>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>

        {/* Match info */}
        <div style={S.matchInfo}>
          <span style={S.teamName}>{match.homeTeam}</span>
          <span style={S.vs}>VS</span>
          <span style={S.teamName}>{match.awayTeam}</span>
        </div>

        {/* Agent votes */}
        <div style={S.votesContainer}>
          {agentVotes.map((agent) => {
            if (!agent.bars) return (
              <div key={agent.id} style={S.agentRow}>
                <div style={S.agentLabel}>
                  <PixelIcon name={agent.id} size={14} color={agentColors[agent.id]} />
                  <span style={{ ...S.agentName, color: agentColors[agent.id] }}>{agent.name}</span>
                </div>
                <span style={S.noPred}>NO DATA</span>
              </div>
            )

            const { home, draw, away } = agent.bars

            return (
              <div key={agent.id} style={S.agentRow}>
                <div style={S.agentLabel}>
                  <PixelIcon name={agent.id} size={14} color={agentColors[agent.id]} />
                  <span style={{ ...S.agentName, color: agentColors[agent.id] }}>{agent.name}</span>
                  <span style={S.methodTag}>{agent.method}</span>
                </div>
                <div style={S.barContainer}>
                  <div style={{ ...S.barSegment, width: `${home * 100}%`, background: accents.green }}>
                    {home > 0.15 && <span style={S.barLabel}>{(home * 100).toFixed(0)}%</span>}
                  </div>
                  <div style={{ ...S.barSegment, width: `${draw * 100}%`, background: accents.gold }}>
                    {draw > 0.15 && <span style={S.barLabel}>{(draw * 100).toFixed(0)}%</span>}
                  </div>
                  <div style={{ ...S.barSegment, width: `${away * 100}%`, background: accents.red }}>
                    {away > 0.15 && <span style={S.barLabel}>{(away * 100).toFixed(0)}%</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Consensus bar */}
        {consensus && (
          <div style={S.consensusSection}>
            <div style={S.consensusLabel}>
              <span style={S.consensusTitle}>CONSENSUS</span>
              <span style={{ ...S.disagreeBadge, color: disagreementColor, borderColor: disagreementColor }}>
                <PixelIcon name="disagree" size={10} color={disagreementColor} />
                {disagreementLevel}
              </span>
            </div>
            <div style={S.barContainer}>
              <div style={{ ...S.barSegment, width: `${consensus.home * 100}%`, background: accents.green }}>
                <span style={S.barLabel}>{(consensus.home * 100).toFixed(0)}%</span>
              </div>
              <div style={{ ...S.barSegment, width: `${consensus.draw * 100}%`, background: accents.gold }}>
                <span style={S.barLabel}>{(consensus.draw * 100).toFixed(0)}%</span>
              </div>
              <div style={{ ...S.barSegment, width: `${consensus.away * 100}%`, background: accents.red }}>
                <span style={S.barLabel}>{(consensus.away * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div style={S.legend}>
              <span><span style={{ color: accents.green }}>■</span> {match.homeTeam}</span>
              <span><span style={{ color: accents.gold }}>■</span> Draw</span>
              <span><span style={{ color: accents.red }}>■</span> {match.awayTeam}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Styles ────────────────────────────────────────────────────────── */
const S: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, background: overlay,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: zIndex.overlay,
  },
  panel: {
    background: palette.wood900, border: borders.standard,
    boxShadow: shadows.hard, padding: spacing.lg,
    maxWidth: 520, width: '90vw', maxHeight: '85vh', overflowY: 'auto',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.md, borderBottom: borders.rule, paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontFamily: fonts.header, ...type.hdr, color: accents.gold,
  },
  closeBtn: {
    background: 'none', border: 'none', color: text.muted, cursor: 'pointer',
    fontFamily: fonts.header, ...type.hdrSm,
  },
  matchInfo: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    gap: spacing.md, marginBottom: spacing.lg,
  },
  teamName: {
    fontFamily: fonts.header, ...type.hdr, color: text.primary,
  },
  vs: {
    fontFamily: fonts.header, ...type.hdrSm, color: text.muted,
  },
  votesContainer: {
    display: 'flex', flexDirection: 'column', gap: spacing.sm,
  },
  agentRow: {
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  agentLabel: {
    display: 'flex', alignItems: 'center', gap: 6,
  },
  agentName: {
    fontFamily: fonts.header, ...type.hdrXs,
  },
  methodTag: {
    fontFamily: fonts.body, ...type.caption, color: text.faint,
    marginLeft: 'auto',
  },
  barContainer: {
    display: 'flex', height: 20, background: palette.surface,
    border: borders.rule, overflow: 'hidden',
  },
  barSegment: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 0, transition: 'width 0.3s ease',
  },
  barLabel: {
    fontFamily: fonts.body, ...type.dataSm, color: palette.bgBlack,
    fontWeight: 'bold', textShadow: 'none',
  },
  noPred: {
    fontFamily: fonts.body, ...type.caption, color: text.faint,
    fontStyle: 'italic',
  },
  consensusSection: {
    marginTop: spacing.lg, paddingTop: spacing.md,
    borderTop: `2px solid ${accents.gold}`,
  },
  consensusLabel: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.sm,
  },
  consensusTitle: {
    fontFamily: fonts.header, ...type.hdr, color: accents.gold,
  },
  disagreeBadge: {
    fontFamily: fonts.header, ...type.hdrXs,
    border: '1px solid', padding: '2px 6px',
    display: 'flex', alignItems: 'center', gap: 4,
  },
  legend: {
    display: 'flex', justifyContent: 'center', gap: spacing.md,
    marginTop: spacing.sm, fontFamily: fonts.body, ...type.caption, color: text.dim,
  },
}
