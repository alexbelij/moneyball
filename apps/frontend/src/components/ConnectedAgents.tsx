/**
 * ConnectedAgents | v1.0.0 | 2026-06-17
 * Purpose: UI panel showing all agents (core + connected) from the Hive
 * registry (T54). Includes a registration form for connecting new external
 * agents. Pixel-styled, tokens-only, no Cyrillic.
 */

import React, { useEffect, useState, useCallback } from 'react'
import {
  listAgents,
  registerHiveAgent,
  type AgentConfigItem,
} from '@/lib/api'
import { PixelButton } from '@/components/ui/PixelButton'
import {
  palette,
  accents,
  text,
  fonts,
  borders,
  shadows,
  spacing,
  zIndex,
  type as typo,
  agentColors,
} from '@/styles/tokens'

interface ConnectedAgentsProps {
  onClose: () => void
}

export function ConnectedAgents({ onClose }: ConnectedAgentsProps) {
  const [agents, setAgents] = useState<AgentConfigItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const fetchAgents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listAgents()
      setAgents(res.agents)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAgents() }, [fetchAgents])

  const coreAgents = agents.filter((a) => a.source === 'core')
  const connectedAgents = agents.filter((a) => a.source === 'connected')

  return (
    <div
      role="dialog"
      aria-label="Connected Agents"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: zIndex.modal,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: palette.wood900,
          border: borders.standard,
          boxShadow: shadows.hard,
          width: 'min(90vw, 640px)',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${spacing.sm}px ${spacing.md}px`,
          borderBottom: borders.standard,
          background: palette.wood700,
        }}>
          <span style={{
            fontFamily: fonts.header,
            fontSize: typo.hdr.fontSize,
            lineHeight: typo.hdr.lineHeight,
            color: accents.gold,
          }}>
            Agent Hive
          </span>
          <PixelButton size="small" onClick={onClose} aria-label="Close">
            X
          </PixelButton>
        </div>

        {/* Body */}
        <div style={{
          overflowY: 'auto',
          padding: spacing.md,
          flex: 1,
        }}>
          {loading && (
            <p style={{ fontFamily: fonts.body, fontSize: typo.body.fontSize, color: text.muted }}>
              Loading agents...
            </p>
          )}
          {error && (
            <p style={{ fontFamily: fonts.body, fontSize: typo.body.fontSize, color: accents.red }}>
              {error}
            </p>
          )}

          {/* Core agents */}
          {!loading && (
            <>
              <SectionTitle title="Core Agents" count={coreAgents.length} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                {coreAgents.map((a) => (
                  <AgentCard key={a.agentId} agent={a} />
                ))}
              </div>

              <div style={{ height: spacing.lg }} />
              <SectionTitle title="Connected Agents" count={connectedAgents.length} />

              {connectedAgents.length === 0 ? (
                <p style={{
                  fontFamily: fonts.body,
                  fontSize: typo.body.fontSize,
                  color: text.muted,
                  margin: `${spacing.sm}px 0`,
                }}>
                  No external agents connected yet. Be the first!
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                  {connectedAgents.map((a) => (
                    <AgentCard key={a.agentId} agent={a} />
                  ))}
                </div>
              )}

              <div style={{ height: spacing.md }} />
              {!showForm ? (
                <PixelButton size="small" onClick={() => setShowForm(true)}>
                  + Connect Agent
                </PixelButton>
              ) : (
                <RegisterForm
                  onRegistered={() => { fetchAgents(); setShowForm(false) }}
                  onCancel={() => setShowForm(false)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <div style={{
      fontFamily: fonts.header,
      fontSize: typo.hdrSm.fontSize,
      lineHeight: typo.hdrSm.lineHeight,
      color: text.primary,
      marginBottom: spacing.sm,
    }}>
      {title} ({count})
    </div>
  )
}

function AgentCard({ agent }: { agent: AgentConfigItem }) {
  const accentColor = agent.source === 'core'
    ? (agentColors[agent.agentId] ?? accents.gold)
    : accents.green

  return (
    <div style={{
      background: palette.surface,
      border: borders.standard,
      borderLeft: `3px solid ${accentColor}`,
      padding: `${spacing.sm}px ${spacing.md}px`,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        <span style={{
          fontFamily: fonts.body,
          fontSize: typo.bodyLg.fontSize,
          lineHeight: typo.bodyLg.lineHeight,
          color: text.primary,
        }}>
          {agent.name}
        </span>
        <span style={{
          fontFamily: fonts.body,
          fontSize: typo.dataSm.fontSize,
          color: accentColor,
          border: `1px solid ${accentColor}`,
          padding: '1px 4px',
        }}>
          {agent.source === 'core' ? 'CORE' : 'EXT'}
        </span>
      </div>
      <span style={{
        fontFamily: fonts.body,
        fontSize: typo.data.fontSize,
        color: text.muted,
      }}>
        {agent.role} — {agent.methodology}
      </span>
      {agent.source === 'connected' && (
        <span style={{
          fontFamily: fonts.body,
          fontSize: typo.caption.fontSize,
          color: text.faint,
        }}>
          ID: {agent.agentId} — joined {new Date(agent.createdAt).toLocaleDateString('en-GB')}
        </span>
      )}
    </div>
  )
}

function RegisterForm({
  onRegistered,
  onCancel,
}: {
  onRegistered: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [persona, setPersona] = useState('')
  const [methodology, setMethodology] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      await registerHiveAgent({ name, role, persona, methodology })
      onRegistered()
    } catch (err: any) {
      setError(err.message ?? 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: fonts.body,
    fontSize: typo.body.fontSize,
    background: palette.wood900,
    color: text.primary,
    border: borders.standard,
    padding: `${spacing.xs}px ${spacing.sm}px`,
    width: '100%',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: fonts.body,
    fontSize: typo.dataSm.fontSize,
    color: text.muted,
    marginBottom: 2,
    display: 'block',
  }

  return (
    <form onSubmit={handleSubmit} style={{
      background: palette.surface,
      border: borders.standard,
      padding: spacing.md,
      display: 'flex',
      flexDirection: 'column',
      gap: spacing.sm,
    }}>
      <span style={{
        fontFamily: fonts.header,
        fontSize: typo.hdrSm.fontSize,
        color: accents.gold,
      }}>
        Connect New Agent
      </span>

      <div>
        <label style={labelStyle}>Name (max 40 chars)</label>
        <input
          style={inputStyle}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          required
          placeholder="e.g. Lucky Bot"
        />
      </div>
      <div>
        <label style={labelStyle}>Role</label>
        <input
          style={inputStyle}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          maxLength={60}
          required
          placeholder="e.g. Random Oracle"
        />
      </div>
      <div>
        <label style={labelStyle}>Persona</label>
        <textarea
          style={{ ...inputStyle, minHeight: 48, resize: 'vertical' }}
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          maxLength={200}
          placeholder="Describe your agent's personality..."
        />
      </div>
      <div>
        <label style={labelStyle}>Methodology</label>
        <input
          style={inputStyle}
          value={methodology}
          onChange={(e) => setMethodology(e.target.value)}
          maxLength={300}
          placeholder="How does your agent pick winners?"
        />
      </div>

      {error && (
        <span style={{ fontFamily: fonts.body, fontSize: typo.dataSm.fontSize, color: accents.red }}>
          {error}
        </span>
      )}

      <div style={{ display: 'flex', gap: spacing.sm }}>
        <PixelButton size="small" type="submit" disabled={busy || !name || !role}>
          {busy ? 'Registering...' : 'Register'}
        </PixelButton>
        <PixelButton size="small" onClick={onCancel} type="button">
          Cancel
        </PixelButton>
      </div>
    </form>
  )
}
