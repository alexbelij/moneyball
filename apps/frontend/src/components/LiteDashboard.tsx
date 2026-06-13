/**
 * LiteDashboard.tsx | v1.2.0 | 2026-06-13
 * Purpose: No-canvas dashboard showing live agent data, leaderboard,
 * and match info. Reads from existing zustand stores — no new sockets.
 * Mobile-first, no animations.
 * T15: embeds StatsReport (predictions table + Brier chart).
 * T33: migrated to shared tokens (all hex → token imports).
 */

import React, { useEffect, useState, useMemo } from 'react'
import { useGameStore } from '@/store/gameStore'
import type { WorldAgentState } from '@moneyball/shared/events'
import { getAgentPredictions, getMatches, getAgentParams } from '@/lib/api'
import { StatsReport } from '@/components/StatsReport'
import { RankMedal } from '@/components/ui'
import { palette, accents, text, fonts, borders, shadows } from '@/styles/tokens'

/* ── Types ──────────────────────────────────────────────────────────────── */

interface PredictionSummary {
  total: number
  correct: number
  latest: { matchId: string; pick: string; confidence: number } | null
}

interface MatchInfo {
  id: string
  homeTeam: string
  awayTeam: string
  kickoffUtc: string
  status: string
  result: { homeScore: number; awayScore: number; outcome: string } | null
}

interface ParamsSummary {
  version: number
  confidenceBias: number
  hedgingLevel: number
}

/* ── Subcomponents ──────────────────────────────────────────────────────── */

function AgentCard({
  agent,
  predictions,
  params,
  onSelect,
}: {
  agent: WorldAgentState
  predictions: PredictionSummary
  params: ParamsSummary | null
  onSelect: () => void
}) {
  const accuracy =
    predictions.total > 0
      ? Math.round((predictions.correct / predictions.total) * 100)
      : null

  return (
    <button
      onClick={onSelect}
      style={styles.card}
      aria-label={`View details for ${agent.name}`}
    >
      <div style={styles.cardHeader}>
        <span style={styles.agentName}>{agent.name}</span>
        <span
          style={{
            ...styles.statusBadge,
            background:
              agent.status === 'idle'
                ? palette.wood700
                : agent.status === 'thinking'
                  ? accents.gold
                  : accents.green,
            color:
              agent.status === 'thinking' || agent.status !== 'idle'
                ? palette.wood900
                : palette.paper,
          }}
        >
          {agent.status}
        </span>
      </div>
      <div style={styles.cardRole}>{agent.role}</div>
      {predictions.latest ? (
        <div style={styles.cardPrediction}>
          <span style={styles.label}>Latest:</span>{' '}
          <span style={styles.pick}>{predictions.latest.pick}</span>{' '}
          <span style={styles.confidence}>
            ({Math.round(predictions.latest.confidence * 100)}%)
          </span>
        </div>
      ) : (
        <div style={styles.cardPrediction}>
          <span style={styles.label}>No predictions yet</span>
        </div>
      )}
      <div style={styles.cardStats}>
        <span>
          {predictions.total} prediction{predictions.total !== 1 ? 's' : ''}
        </span>
        {accuracy !== null && (
          <span style={styles.accuracy}>
            {accuracy}% accuracy
          </span>
        )}
      </div>
      {params && (
        <div style={styles.cardMeta}>
          v{params.version} · bias {params.confidenceBias >= 0 ? '+' : ''}
          {params.confidenceBias.toFixed(3)} · hedge{' '}
          {params.hedgingLevel.toFixed(2)}
        </div>
      )}
    </button>
  )
}

function MatchCard({ match }: { match: MatchInfo }) {
  const time = new Date(match.kickoffUtc).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div style={styles.matchCard}>
      <div style={styles.matchTeams}>
        <span>{match.homeTeam}</span>
        {match.result ? (
          <span style={styles.matchScore}>
            {match.result.homeScore} – {match.result.awayScore}
          </span>
        ) : (
          <span style={styles.matchVs}>vs</span>
        )}
        <span>{match.awayTeam}</span>
      </div>
      <div style={styles.matchTime}>
        {match.status === 'live' ? (
          <span style={styles.liveTag}>
            <span style={styles.liveDot} aria-hidden="true" />LIVE
          </span>
        ) : (
          time
        )}
      </div>
    </div>
  )
}

function Leaderboard({
  agents,
  predictions,
}: {
  agents: WorldAgentState[]
  predictions: Record<string, PredictionSummary>
}) {
  const sorted = useMemo(() => {
    return [...agents]
      .map((a) => ({
        ...a,
        correct: predictions[a.agentId]?.correct ?? 0,
        total: predictions[a.agentId]?.total ?? 0,
      }))
      .sort((a, b) => b.correct - a.correct || a.total - b.total)
  }, [agents, predictions])

  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>LEADERBOARD</h2>
      <div style={styles.leaderboard}>
        {sorted.map((a, i) => (
          <div
            key={a.agentId}
            style={{
              ...styles.leaderRow,
              background: i % 2 === 0 ? palette.paperBright : palette.paper,
              borderTop: i === 0 ? 'none' : borders.rule,
            }}
          >
            <RankMedal rank={i + 1} />
            <span style={styles.leaderName}>{a.name}</span>
            <span style={styles.leaderScore}>
              {a.correct}/{a.total}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Main Dashboard ─────────────────────────────────────────────────────── */

export function LiteDashboard() {
  const agentsMap = useGameStore((s) => s.agents)
  const isConnected = useGameStore((s) => s.ui.isConnected)
  const selectAgent = useGameStore((s) => s.selectAgent)

  const agents = useMemo(
    () => Object.values(agentsMap),
    [agentsMap],
  )

  const [predictions, setPredictions] = useState<
    Record<string, PredictionSummary>
  >({})
  const [params, setParams] = useState<Record<string, ParamsSummary>>({})
  const [matches, setMatches] = useState<{
    live: MatchInfo[]
    upcoming: MatchInfo[]
    recent: MatchInfo[]
  }>({ live: [], upcoming: [], recent: [] })

  // Fetch predictions and params for each agent
  useEffect(() => {
    let cancelled = false

    async function load() {
      const agentIds = [
        'dr_morgan',
        'scout_alvarez',
        'viktor_kane',
        'sofia_mendes',
        'madame_pythia',
      ]

      const predMap: Record<string, PredictionSummary> = {}
      const paramMap: Record<string, ParamsSummary> = {}

      await Promise.all(
        agentIds.map(async (id) => {
          try {
            const predRes = await getAgentPredictions(id)
            const items = predRes.items ?? []
            const resolved = items.filter(
              (p: { outcome?: { correct: boolean } | null }) => p.outcome != null,
            )
            const correct = resolved.filter(
              (p: { outcome?: { correct: boolean } | null }) => p.outcome?.correct === true,
            ).length
            const latest = items[0] ?? null
            predMap[id] = {
              total: resolved.length,
              correct,
              latest: latest
                ? {
                    matchId: latest.matchId,
                    pick: latest.pick,
                    confidence: latest.confidence,
                  }
                : null,
            }
          } catch {
            predMap[id] = { total: 0, correct: 0, latest: null }
          }

          try {
            const paramRes = await getAgentParams(id)
            const p = paramRes.params
            if (p) {
              paramMap[id] = {
                version: p.version,
                confidenceBias: p.confidenceBias,
                hedgingLevel: p.hedgingLevel,
              }
            }
          } catch {
            // params not critical
          }
        }),
      )

      if (!cancelled) {
        setPredictions(predMap)
        setParams(paramMap)
      }
    }

    void load()
    const interval = setInterval(() => void load(), 30_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // Fetch matches
  useEffect(() => {
    let cancelled = false

    async function loadMatches() {
      try {
        const res = await getMatches()
        if (!cancelled) {
          setMatches({
            live: res.live ?? [],
            upcoming: res.upcoming ?? [],
            recent: res.recent ?? [],
          })
        }
      } catch {
        // non-critical
      }
    }

    void loadMatches()
    const interval = setInterval(() => void loadMatches(), 30_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const displayMatches = [
    ...matches.live,
    ...matches.upcoming.slice(0, 3),
  ]

  return (
    <div style={styles.root}>
      {/* Connection status */}
      <div style={styles.header}>
        <h1 style={styles.title}>MONEYBALL CABINET</h1>
        <span
          style={{
            ...styles.connectionDot,
            background: isConnected ? accents.green : accents.red,
          }}
          aria-label={isConnected ? 'Connected' : 'Disconnected'}
        />
      </div>

      {/* Matches */}
      {displayMatches.length > 0 && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>MATCHES</h2>
          {displayMatches.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}

      {/* Agents */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>AGENTS</h2>
        <div style={styles.agentsGrid}>
          {agents.map((agent) => (
            <AgentCard
              key={agent.agentId}
              agent={agent}
              predictions={
                predictions[agent.agentId] ?? {
                  total: 0,
                  correct: 0,
                  latest: null,
                }
              }
              params={params[agent.agentId] ?? null}
              onSelect={() => selectAgent(agent.agentId)}
            />
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      {agents.length > 0 && (
        <Leaderboard agents={agents} predictions={predictions} />
      )}

      {/* T15: Detailed predictions + Brier chart */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>SCOUTING REPORT</h2>
        <StatsReport />
      </div>

      {/* Recent results */}
      {matches.recent.length > 0 && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>RECENT RESULTS</h2>
          {matches.recent.slice(0, 5).map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Styles (inline, mobile-first) ──────────────────────────────────────── */

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'absolute',
    inset: 0,
    overflow: 'auto',
    background: palette.surface,
    color: palette.paper,
    fontFamily: fonts.body,
    padding: '16px',
    paddingBottom: '80px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 12,
    fontWeight: 700,
    margin: 0,
    color: accents.gold,
    fontFamily: fonts.header,
    letterSpacing: '-0.5px',
  },
  connectionDot: {
    width: 10,
    height: 10,
    borderRadius: 0,
    flexShrink: 0,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: text.muted,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    fontFamily: fonts.header,
  },
  agentsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 12,
  },
  card: {
    display: 'block',
    width: '100%',
    textAlign: 'left' as const,
    background: palette.wood900,
    border: borders.standard,
    borderRadius: 0,
    padding: 12,
    cursor: 'pointer',
    color: palette.paper,
    fontFamily: fonts.body,
    fontSize: 14,
    boxShadow: shadows.hardSmall,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  agentName: {
    fontWeight: 700,
    fontSize: 15,
  },
  statusBadge: {
    fontSize: 11,
    padding: '2px 6px',
    borderRadius: 0,
    color: palette.paper,
    textTransform: 'uppercase' as const,
    fontFamily: fonts.header,
    letterSpacing: '-0.5px',
  },
  cardRole: {
    fontSize: 13,
    color: text.muted,
    marginBottom: 8,
  },
  cardPrediction: {
    marginBottom: 4,
  },
  label: {
    color: text.faint,
    fontSize: 13,
  },
  pick: {
    fontWeight: 600,
    color: accents.gold,
  },
  confidence: {
    color: text.muted,
    fontSize: 13,
  },
  cardStats: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    color: text.muted,
    marginTop: 4,
  },
  accuracy: {
    color: accents.green,
    fontWeight: 600,
  },
  cardMeta: {
    fontSize: 12,
    color: text.faint,
    marginTop: 4,
    fontStyle: 'italic' as const,
  },
  matchCard: {
    background: palette.wood900,
    border: borders.standard,
    borderRadius: 0,
    padding: '8px 12px',
    marginBottom: 6,
    boxShadow: shadows.hardSmall,
  },
  matchTeams: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 14,
    fontWeight: 600,
  },
  matchVs: {
    color: text.faint,
    fontSize: 13,
  },
  matchScore: {
    color: accents.gold,
    fontWeight: 700,
    fontSize: 16,
  },
  matchTime: {
    fontSize: 12,
    color: text.faint,
    marginTop: 4,
  },
  liveTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    color: accents.red,
    fontFamily: fonts.header,
    fontSize: 9,
    letterSpacing: '-0.5px',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 0,
    background: accents.red,
    display: 'inline-block',
  },
  // T34: paper leaderboard panel — wood-ramp rows, dark text, medal ranks.
  leaderboard: {
    background: palette.paper,
    border: borders.standard,
    borderRadius: 0,
    overflow: 'hidden',
    boxShadow: shadows.hardSmall,
  },
  leaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    fontSize: 15,
    color: palette.wood900,
  },
  leaderName: {
    flex: 1,
    fontWeight: 700,
    color: palette.wood900,
  },
  leaderScore: {
    fontWeight: 700,
    color: palette.wood700,
  },
}
