/**
 * AgentModal | v0.3.0 | 2026-06-09
 * Purpose: Agent info + user actions. Admin-only controls require JWT role=admin.
 */

import React, { useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { roast, disagree, adminDayPlusOne } from '@/lib/api'
import { GameEventBus } from '@/events/GameEventBus'
import { useAuthStore } from '@/store/authStore'

export function AgentModal() {
  const selected = useGameStore((s) => s.ui.selectedAgentId)
  const agent = useGameStore((s) => (selected ? s.agents[selected] : null))
  const close = () => useGameStore.getState().selectAgent(null)

  const viewer = useAuthStore((s) => s.viewer)
  const isAdmin = viewer?.role === 'admin'

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!agent) return null

  async function onRoast() {
    setErr(null); setBusy(true)
    try {
      const r = await roast(agent.agentId)
      GameEventBus.emit('thought:show', { agentId: agent.agentId, text: r.text, duration: 3500 })
    } catch (e: any) {
      setErr(e.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  async function onDisagree() {
    setErr(null); setBusy(true)
    try {
      await disagree(agent.agentId)
      const r = await roast(agent.agentId)
      GameEventBus.emit('thought:show', { agentId: agent.agentId, text: r.text, duration: 3500 })
    } catch (e: any) {
      setErr(e.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  async function onSimulateDayPlusOne() {
    setErr(null); setBusy(true)
    try {
      await adminDayPlusOne(agent.agentId)
      const r = await roast(agent.agentId)
      GameEventBus.emit('thought:show', { agentId: agent.agentId, text: `[Day+1] ${r.text}`, duration: 4000 })
    } catch (e: any) {
      setErr('Admin action failed (requires admin role).')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      onClick={close}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          height: '100%',
          background: '#111827',
          borderLeft: '1px solid #374151',
          padding: 16,
          color: '#e5e7eb',
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
          <button
            onClick={close}
            style={{ background: 'none', border: 0, color: '#9ca3af', fontSize: 18, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button disabled={busy} onClick={onRoast} style={btn()}>
            Roast me
          </button>
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

        <div style={{ marginTop: 16, fontSize: 11, color: '#6b7280' }}>
          Identity: {viewer ? `Sui (${viewer.role})` : 'Guest'}
        </div>
      </div>
    </div>
  )
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
