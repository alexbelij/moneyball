/**
 * EvolutionView | v1.0.0 | 2026-06-19
 * Before/After agent evolution demo.
 * Shows how an agent's predictions changed over time,
 * with parameter diffs and evolution reasoning from MemWal logs.
 *
 * Killer demo material for jury: "our agents LEARN and EVOLVE."
 */

import React, { useMemo, useState, useEffect } from 'react'
import { palette, accents, text, fonts, type, borders, shadows, spacing, agentColors, overlay, zIndex } from '@/styles/tokens'
import { PixelIcon } from '@/components/icons/PixelIcon'
import { useGameStore } from '@/store/gameStore'
import { getAgentEvolution, type EvolutionItem } from '@/lib/api'
import { walrusBlobUrl } from '@/lib/explorer'
import { useFocusTrap } from '@/lib/a11y/useFocusTrap'

interface EvolutionViewProps {
  agentId: string
  onClose: () => void
}

export function EvolutionView({ agentId, onClose }: EvolutionViewProps) {
  const agent = useGameStore((s) => s.agents[agentId])
  const [evolutions, setEvolutions] = useState<EvolutionItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getAgentEvolution(agentId)
      .then((res) => setEvolutions(res.items))
      .catch(() => setEvolutions([]))
      .finally(() => setLoading(false))
  }, [agentId])

  const color = agentColors[agentId] ?? accents.gold
  const agentName = agent?.name ?? agentId.replace(/_/g, ' ')
  const hasEvolution = evolutions.length > 0

  const first = evolutions[0]
  const last = evolutions[evolutions.length - 1]

  const trapRef = useFocusTrap<HTMLDivElement>({ onClose, active: true })

  return (
    <div style={S.backdrop} onClick={onClose} role="presentation">
      <div ref={trapRef} style={S.panel} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${agentName} evolution history`}>
        {/* Header */}
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PixelIcon name={agentId} size={18} color={color} />
            <span style={{ ...S.headerTitle, color }}>
              {agentName.toUpperCase()}
            </span>
          </div>
          <span style={S.evolutionBadge}>
            <PixelIcon name="evolve" size={12} color={accents.gold} />
            EVOLUTION
          </span>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>

        {loading ? (
          <div style={S.noEvolution}>
            <span style={{ fontFamily: fonts.body, ...type.body, color: text.muted }}>
              Loading evolution data from MemWal...
            </span>
          </div>
        ) : hasEvolution ? (
          <>
            {/* Evolution timeline */}
            <div style={S.timelineContainer}>
              {evolutions.map((evo, i) => (
                <div key={i} style={S.evoCard}>
                  <div style={S.evoHeader}>
                    <span style={{ fontFamily: fonts.header, ...type.hdrXs, color: accents.gold }}>
                      v{evo.fromVersion ?? i} → v{evo.toVersion ?? i + 1}
                    </span>
                    <span style={{ fontFamily: fonts.body, ...type.caption, color: text.faint }}>
                      {new Date(evo.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Parameter diff */}
                  {evo.parameterDiff && Object.keys(evo.parameterDiff).length > 0 && (
                    <div style={S.paramGrid}>
                      {Object.entries(evo.parameterDiff).map(([key, delta]) => (
                        <div key={key} style={S.paramRow}>
                          <span style={S.paramKey}>{key}</span>
                          <span style={{
                            ...S.paramVal,
                            color: delta > 0 ? accents.green : delta < 0 ? accents.red : text.dim,
                          }}>
                            {delta > 0 ? '+' : ''}{typeof delta === 'number' ? delta.toFixed(3) : delta}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reasoning */}
                  <p style={S.reasoningText}>"{evo.summary}"</p>

                  {/* Walrus proof + provenance badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    {evo.blobId && (
                      <a
                        href={walrusBlobUrl(evo.blobId)}
                        target="_blank"
                        rel="noreferrer noopener"
                        aria-label="Verify this memory on Walrus"
                        style={S.proofTag}
                      >
                        <PixelIcon name="walrus" size={10} color={accents.gold} />
                        <span style={{ fontFamily: fonts.body, ...type.caption, color: text.faint }}>
                          blob:{evo.blobId.slice(0, 8)}…
                        </span>
                      </a>
                    )}
                    {evo.source && (
                      <span style={{
                        ...type.caption,
                        fontFamily: fonts.header,
                        padding: '1px 4px',
                        border: borders.standard,
                        color: evo.source === 'live' ? accents.gold : text.faint,
                        background: evo.source === 'live' ? palette.wood700 : palette.wood900,
                      }}>
                        {evo.source === 'live' ? 'LIVE' : 'SEED'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div style={S.summary}>
              <span style={{ fontFamily: fonts.header, ...type.hdrXs, color: text.muted }}>
                {evolutions.length} evolution{evolutions.length > 1 ? 's' : ''} recorded on Walrus Memory
              </span>
            </div>
          </>
        ) : (
          <div style={S.noEvolution}>
            <PixelIcon name="predict" size={24} color={text.muted} />
            <span style={{ fontFamily: fonts.body, ...type.body, color: text.muted, marginTop: 8 }}>
              No evolution data yet.
            </span>
            <span style={{ fontFamily: fonts.body, ...type.caption, color: text.faint }}>
              Agents evolve during sleep cycles after matches resolve.
            </span>
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
    maxWidth: 600, width: '95vw', maxHeight: '85vh', overflowY: 'auto',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.md, borderBottom: borders.rule, paddingBottom: spacing.sm,
    flexWrap: 'wrap', gap: 8,
  },
  headerTitle: {
    fontFamily: fonts.header, ...type.hdr,
  },
  evolutionBadge: {
    fontFamily: fonts.header, ...type.hdrXs, color: accents.gold,
    border: `1px solid ${accents.gold}`, padding: '2px 6px',
    display: 'flex', alignItems: 'center', gap: 4,
  },
  closeBtn: {
    background: 'none', border: 'none', color: text.muted, cursor: 'pointer',
    fontFamily: fonts.header, ...type.hdrSm,
  },
  timelineContainer: {
    display: 'flex', flexDirection: 'column', gap: spacing.sm,
  },
  evoCard: {
    background: palette.surface, border: borders.rule, padding: spacing.sm,
  },
  evoHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 4,
  },
  paramGrid: {
    display: 'flex', flexDirection: 'column', gap: 2,
    marginBottom: 4,
  },
  paramRow: {
    display: 'flex', justifyContent: 'space-between', padding: '1px 0',
  },
  paramKey: {
    fontFamily: fonts.body, ...type.dataSm, color: text.muted,
  },
  paramVal: {
    fontFamily: fonts.body, ...type.dataSm,
  },
  reasoningText: {
    fontFamily: fonts.body, ...type.dataSm, color: text.dim,
    margin: '4px 0 0', fontStyle: 'italic',
  },
  proofTag: {
    display: 'flex', alignItems: 'center', gap: 4,
    marginTop: 4,
    textDecoration: 'none',
    cursor: 'pointer',
  },
  summary: {
    marginTop: spacing.md, paddingTop: spacing.sm, borderTop: borders.rule,
    textAlign: 'center',
  },
  noEvolution: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: spacing.xl, gap: 4,
  },
}
