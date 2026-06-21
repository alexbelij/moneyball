/**
 * AgentJournal | v1.0.0 | 2026-06-17
 * Purpose: Narrative "journal" of agent decisions, showing how memory
 * shaped behavior over time. Core UI for "Memory Moment" judging criterion.
 * Each entry tells a human story: "I predicted X, I was wrong, I adjusted."
 */

import React from 'react'
import { getAgentPredictions, getAgentEvolution, getAgentProfile } from '@/lib/api'
import { buildJournalEntries, type JournalEntry } from '@/lib/journalEntries'
import { formatTimestamp } from '@/lib/formatDate'
import { palette, accents, text, fonts, borders, shadows, type as typo, spacing, } from '@/styles/tokens'
import { walrusBlobUrl } from '@/lib/explorer'

function useFetchJournal(agentId: string) {
  const [entries, setEntries] = React.useState<JournalEntry[] | null>(null)
  const [agentName, setAgentName] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      getAgentProfile(agentId),
      getAgentPredictions(agentId),
      getAgentEvolution(agentId),
    ]).then(
      ([profileRes, predRes, evoRes]) => {
        if (!alive) return
        const name = profileRes?.profile?.name ?? agentId
        setAgentName(name)
        setEntries(buildJournalEntries(name, predRes.items ?? [], evoRes.items ?? []))
        setLoading(false)
      },
      (e: any) => {
        if (!alive) return
        setErr(e?.message ?? String(e))
        setLoading(false)
      },
    )
    return () => { alive = false }
  }, [agentId])

  return { entries, agentName, loading, err }
}

/** Pixel-art dot for journal entry kind */
function KindDot({ kind, sentiment }: { kind: JournalEntry['kind']; sentiment: JournalEntry['sentiment'] }) {
  const color = kind === 'prediction'
    ? (sentiment === 'positive' ? accents.green : sentiment === 'negative' ? accents.red : text.muted)
    : accents.gold
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        background: color,
        flexShrink: 0,
        marginTop: 4,
      }}
    />
  )
}

export function AgentJournal({ agentId }: { agentId: string }) {
  const { entries, loading, err } = useFetchJournal(agentId)

  if (loading) return <div style={{ ...typo.dataSm, color: text.muted, marginTop: 8 }}>Loading journal...</div>
  if (err) return <div style={{ ...typo.dataSm, color: accents.red, marginTop: 8 }}>{err}</div>
  if (!entries || entries.length === 0) {
    return (
      <div style={{ ...typo.dataSm, color: text.muted, marginTop: 8 }}>
        No journal entries yet — waiting for the first resolved prediction and sleep cycle.
      </div>
    )
  }

  return (
    <div role="log" aria-label="Agent decision journal">
      <div style={{
        ...typo.hdrSm, fontFamily: fonts.header, color: text.muted,
        letterSpacing: '-0.5px', textTransform: 'uppercase', marginBottom: 8,
      }}>
        DECISION JOURNAL
      </div>
      <div style={{
        borderLeft: `2px solid ${palette.wood500}`,
        paddingLeft: 12,
        marginLeft: 3,
      }}>
        {entries.map((entry, i) => (
          <div
            key={`${entry.date}-${i}`}
            style={{
              position: 'relative',
              paddingBottom: i < entries.length - 1 ? 12 : 0,
              marginBottom: i < entries.length - 1 ? 4 : 0,
            }}
          >
            {/* Timeline dot */}
            <div style={{
              position: 'absolute',
              left: -17,
              top: 2,
            }}>
              <KindDot kind={entry.kind} sentiment={entry.sentiment} />
            </div>

            {/* Entry content */}
            <div style={{
              background: palette.surface,
              border: borders.standard,
              padding: 8,
              boxShadow: shadows.hardSmall,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
                <div style={{
                  ...typo.dataSm,
                  color: entry.sentiment === 'positive' ? accents.green
                    : entry.sentiment === 'negative' ? accents.red
                    : accents.gold,
                  fontWeight: 700,
                }}>
                  {entry.headline}
                </div>
                <div style={{
                  ...typo.caption,
                  color: text.faint,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}>
                  {formatTimestamp(entry.date)}
                </div>
              </div>
              <div style={{ ...typo.caption, color: text.dim, marginTop: 4 }}>
                {entry.body}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                {entry.blobId && (
                  <a
                    href={walrusBlobUrl(entry.blobId)}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label="Verify this memory on Walrus"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      textDecoration: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{
                      width: 6, height: 6,
                      background: accents.gold,
                      display: 'inline-block',
                      flexShrink: 0,
                    }} />
                    <span style={{ ...typo.caption, color: text.faint }}>
                      blob:{entry.blobId.slice(0, 8)}…
                    </span>
                  </a>
                )}
                {entry.source && (
                  <span style={{
                    ...typo.caption,
                    fontFamily: fonts.header,
                    padding: '1px 4px',
                    border: borders.standard,
                    color: entry.source === 'live' ? accents.gold : text.faint,
                    background: entry.source === 'live' ? palette.wood700 : palette.wood900,
                  }}>
                    {entry.source === 'live' ? 'LIVE' : 'SEED'}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
