/**
 * RoastCard | v1.0.0 | 2026-06-17
 * Purpose: Shareable roast card — 16-bit-pixel aesthetic canvas image (T61).
 * Generates a canvas-based card with the roast text, agent name/role, and
 * Moneyball branding. Offers Download (PNG) and Share (Web Share API) buttons.
 *
 * Design:
 * - 600x340 canvas (OG-image friendly 1.76:1)
 * - Dark wood900 background with wood700 border
 * - Agent accent color left stripe
 * - VT323 body font for roast text, Press Start 2P for agent name
 * - Gold "MONEYBALL" footer branding
 */

import React, { useRef, useEffect, useCallback, useState } from 'react'
import { PixelButton } from '@/components/ui/PixelButton'
import {
  palette,
  accents,
  text as textTokens,
  fonts,
  borders,
  shadows,
  spacing,
  agentColors,
  type as typo,
} from '@/styles/tokens'

interface RoastCardProps {
  agentId: string
  agentName: string
  agentRole: string
  roastText: string
  onClose: () => void
}

const CARD_W = 600
const CARD_H = 340
const PAD = 24
const STRIPE_W = 6
const FONT_BODY = '22px VT323, monospace'
const FONT_HEADER = '11px "Press Start 2P", monospace'
const FONT_BRAND = '10px "Press Start 2P", monospace'

/** Word-wrap text to fit a max pixel width on a canvas context. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

function drawCard(
  canvas: HTMLCanvasElement,
  agentId: string,
  agentName: string,
  agentRole: string,
  roastText: string,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = CARD_W
  canvas.height = CARD_H

  // Background
  ctx.fillStyle = palette.wood900
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  // Border (2px)
  ctx.strokeStyle = palette.wood700
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, CARD_W - 2, CARD_H - 2)

  // Inner border (subtle)
  ctx.strokeStyle = palette.wood500
  ctx.lineWidth = 1
  ctx.strokeRect(4, 4, CARD_W - 8, CARD_H - 8)

  // Agent accent stripe (left)
  const accentColor = agentColors[agentId] ?? accents.gold
  ctx.fillStyle = accentColor
  ctx.fillRect(8, 8, STRIPE_W, CARD_H - 16)

  // Scanline overlay (16-bit feel — very subtle)
  ctx.fillStyle = 'rgba(0,0,0,0.08)'
  for (let y = 0; y < CARD_H; y += 3) {
    ctx.fillRect(0, y, CARD_W, 1)
  }

  const textX = 8 + STRIPE_W + PAD
  const textMaxW = CARD_W - textX - PAD

  // Agent name
  ctx.font = FONT_HEADER
  ctx.fillStyle = accentColor
  ctx.textBaseline = 'top'
  ctx.fillText(agentName.toUpperCase(), textX, 20)

  // Agent role
  ctx.font = FONT_BODY
  ctx.fillStyle = palette.wood300
  ctx.fillText(agentRole, textX, 40)

  // Divider line
  ctx.strokeStyle = palette.wood700
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(textX, 62)
  ctx.lineTo(CARD_W - PAD, 62)
  ctx.stroke()

  // Roast text (wrapped)
  ctx.font = FONT_BODY
  ctx.fillStyle = palette.paper
  const roastLines = wrapText(ctx, `"${roastText}"`, textMaxW)
  const lineH = 26
  const roastY = 76
  const maxLines = 7
  for (let i = 0; i < Math.min(roastLines.length, maxLines); i++) {
    let line = roastLines[i]
    if (i === maxLines - 1 && roastLines.length > maxLines) {
      line = line.slice(0, -3) + '...'
    }
    ctx.fillText(line, textX, roastY + i * lineH)
  }

  // Footer branding
  const footerY = CARD_H - 30
  ctx.strokeStyle = palette.wood700
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(textX, footerY - 6)
  ctx.lineTo(CARD_W - PAD, footerY - 6)
  ctx.stroke()

  ctx.font = FONT_BRAND
  ctx.fillStyle = accents.gold
  ctx.fillText('MONEYBALL', textX, footerY)

  ctx.font = '18px VT323, monospace'
  ctx.fillStyle = palette.wood300
  ctx.fillText('taken.wal.app', textX + 140, footerY + 1)
}

export function RoastCard({ agentId, agentName, agentRole, roastText, onClose }: RoastCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [shareSupported] = useState(() => typeof navigator.share === 'function')

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      drawCard(canvas, agentId, agentName, agentRole, roastText)
    }
  }, [agentId, agentName, agentRole, roastText])

  const getBlob = useCallback(async (): Promise<Blob | null> => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  }, [])

  const handleDownload = useCallback(async () => {
    const blob = await getBlob()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `moneyball-roast-${agentId}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [getBlob, agentId])

  const handleShare = useCallback(async () => {
    const blob = await getBlob()
    if (!blob) return
    const file = new File([blob], `moneyball-roast-${agentId}.png`, { type: 'image/png' })
    try {
      await navigator.share({
        title: `${agentName} roasted me!`,
        text: roastText,
        files: [file],
      })
    } catch {
      // User cancelled or share not supported for files — fallback to download
      handleDownload()
    }
  }, [getBlob, agentId, agentName, roastText, handleDownload])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
    }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          maxWidth: CARD_W,
          height: 'auto',
          imageRendering: 'pixelated',
          border: borders.standard,
          boxShadow: shadows.hardSmall,
        }}
      />
      <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
        <PixelButton size="small" onClick={handleDownload}>
          Download
        </PixelButton>
        {shareSupported && (
          <PixelButton size="small" onClick={handleShare}>
            Share
          </PixelButton>
        )}
        <PixelButton size="small" onClick={onClose}>
          Close
        </PixelButton>
      </div>
    </div>
  )
}
