/**
 * MatchTV | v0.4.0 | 2026-06-19
 * Purpose: Cabinet TV ticker — live/next/recent WC2026 matches from the
 * public match feed. Polls every 30s; collapsible to a one-line bar.
 * FIX: outside-click close + × button (#4).
 * T49: typography scale — body ≥16px; responsive max-width.
 * T33: migrated to shared tokens.
 */

import React, { useEffect, useRef, useState } from 'react'
import { getMatches, type MatchInfo } from '@/lib/api'
import { GameEventBus } from '@/events/GameEventBus'
import { palette, accents, text, fonts, borders, shadows, zIndex, type as typo } from '@/styles/tokens'
import { formatKickoff } from '@/lib/formatDate'

const POLL_MS = 30_000

export function MatchTV() {
  const [feed, setFeed] = useState<{ live: MatchInfo[]; upcoming: MatchInfo[]; recent: MatchInfo[] } | null>(null)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    const load = () => getMatches().then(
      (r) => {
        if (!alive) return
        setFeed({ live: r.live, upcoming: r.upcoming, recent: r.recent })
        GameEventBus.emit('matches:live', { live: r.live.length > 0 })
      },
      () => undefined,
    )
    load()
    const t = setInterval(load, POLL_MS)
    return () => { alive = false; clearInterval(t) }
  }, [])

  /* Outside-click close */
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const live = feed?.live[0]
  const next = feed?.upcoming[0]
  const headline = live
    ? `LIVE ${live.homeTeam} vs ${live.awayTeam}`
    : next
      ? `Next: ${next.homeTeam} vs ${next.awayTeam} · ${kickoff(next)}`
      : 'WC2026'

  return (
    <div ref={containerRef} style={{
      position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
      zIndex: zIndex.matchTV, width: open ? 460 : 'auto', maxWidth: '92vw',
      background: palette.wood900, border: borders.standard, borderRadius: 0,
      color: palette.paper, ...typo.body, fontFamily: fonts.body,
      overflow: 'hidden', boxShadow: shadows.hardSmall,
    }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
          background: 'none', border: 0, color: palette.paper, cursor: 'pointer',
          ...typo.body, fontFamily: fonts.body,
        }}
      >
        {live ? <span style={{ color: accents.red }}>■ </span> : <span style={{ color: accents.gold }}>▶ </span>}
        {headline}
        {open ? (
          <span style={{ float: 'right', color: text.muted, cursor: 'pointer' }}>✕</span>
        ) : (
          <span style={{ color: text.faint, marginLeft: 6 }}>▴</span>
        )}
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
      <div style={{ color: text.muted, ...typo.caption, fontFamily: fonts.body, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
      {items.length === 0 && <div style={{ color: text.faint, marginTop: 2 }}>{empty}</div>}
      {items.map((m) => (
        <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
          <span>{m.homeTeam} vs {m.awayTeam}</span>
          <span style={{ color: text.muted }}>
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
  return formatKickoff(m.kickoffUtc)
}
