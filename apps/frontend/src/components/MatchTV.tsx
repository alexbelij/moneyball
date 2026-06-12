/**
 * MatchTV | v0.1.1 | 2026-06-12
 * Purpose: Cabinet TV ticker — live/next/recent WC2026 matches from the
 * public match feed. Polls every 30s; collapsible to a one-line bar.
 */

import React, { useEffect, useState } from 'react'
import { getMatches, type MatchInfo } from '@/lib/api'
import { GameEventBus } from '@/events/GameEventBus'

const POLL_MS = 30_000

export function MatchTV() {
  const [feed, setFeed] = useState<{ live: MatchInfo[]; upcoming: MatchInfo[]; recent: MatchInfo[] } | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    const load = () => getMatches().then(
      (r) => {
        if (!alive) return
        setFeed({ live: r.live, upcoming: r.upcoming, recent: r.recent })
        GameEventBus.emit('matches:live', { live: r.live.length > 0 }) // drives cabinet TV state
      },
      () => undefined, // keep last good feed on transient errors
    )
    load()
    const t = setInterval(load, POLL_MS)
    return () => { alive = false; clearInterval(t) }
  }, [])

  const live = feed?.live[0]
  const next = feed?.upcoming[0]
  const headline = live
    ? `🔴 LIVE ${live.homeTeam} vs ${live.awayTeam}`
    : next
      ? `📺 Next: ${next.homeTeam} vs ${next.awayTeam} · ${kickoff(next)}`
      : '📺 WC2026'

  return (
    <div style={{
      position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
      zIndex: 55, width: open ? 460 : 'auto', maxWidth: '92vw',
      background: 'rgba(17,24,39,0.92)', border: '1px solid #374151', borderRadius: 10,
      color: '#e5e7eb', fontSize: 12, overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
          background: 'none', border: 0, color: '#e5e7eb', cursor: 'pointer', fontSize: 12,
        }}
      >
        {headline} <span style={{ color: '#6b7280' }}>{open ? '▾' : '▴'}</span>
      </button>

      {open && feed && (
        <div style={{ padding: '0 12px 10px' }}>
          <Section title="Live" items={feed.live} empty="No match in play." />
          <Section title="Upcoming" items={feed.upcoming.slice(0, 4)} empty="No scheduled fixtures in window." />
          <Section title="Recent" items={feed.recent.slice(0, 4)} empty="No finished matches yet." />
        </div>
      )}
    </div>
  )
}

function Section({ title, items, empty }: { title: string; items: MatchInfo[]; empty: string }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
      {items.length === 0 && <div style={{ color: '#6b7280', marginTop: 2 }}>{empty}</div>}
      {items.map((m) => (
        <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
          <span>{m.homeTeam} vs {m.awayTeam}</span>
          <span style={{ color: '#9ca3af' }}>
            {m.status === 'finished' && m.result
              ? `${m.result.homeScore}–${m.result.awayScore}`
              : m.status === 'live' ? 'LIVE' : kickoff(m)}
          </span>
        </div>
      ))}
    </div>
  )
}

function kickoff(m: MatchInfo) {
  const d = new Date(m.kickoffUtc)
  const today = new Date().toDateString() === d.toDateString()
  return today
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
