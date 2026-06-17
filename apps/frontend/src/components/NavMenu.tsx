/**
 * NavMenu | v1.0.0 | 2026-06-17
 * Purpose: Pixel menu button + dropdown that opens cabinet sections as overlay
 *          panels (T51). No routing reload — selecting an item sets the active
 *          section in the nav store. Keyboard accessible (Escape closes, arrow
 *          focus is native button order).
 */

import React, { useEffect, useRef } from 'react'
import { PixelButton } from '@/components/ui'
import { useNavStore } from '@/store/navStore'
import { NAV_SECTIONS } from '@/lib/navSections'
import { palette, text, spacing, borders, shadows, zIndex, type as typo, fonts } from '@/styles/tokens'

export function NavMenu() {
  const menuOpen = useNavStore((s) => s.menuOpen)
  const toggleMenu = useNavStore((s) => s.toggleMenu)
  const setMenuOpen = useNavStore((s) => s.setMenuOpen)
  const open = useNavStore((s) => s.open)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape while the dropdown is open.
  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen, setMenuOpen])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: zIndex.stats,
      }}
    >
      <PixelButton
        size="small"
        onClick={toggleMenu}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Open cabinet menu"
      >
        MENU
      </PixelButton>

      {menuOpen && (
        <div
          role="menu"
          aria-label="Cabinet sections"
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: spacing.xs,
            background: palette.surface,
            border: borders.standard,
            boxShadow: shadows.hard,
            padding: spacing.xs,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 180,
          }}
        >
          {NAV_SECTIONS.map((s) => (
            <button
              key={s.id}
              role="menuitem"
              type="button"
              disabled={!s.available}
              onClick={() => {
                if (s.available) open(s.id)
              }}
              style={{
                ...typo.dataSm,
                fontFamily: fonts.body,
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                color: s.available ? text.primary : text.muted,
                padding: `${spacing.xs}px ${spacing.sm}px`,
                cursor: s.available ? 'pointer' : 'default',
                opacity: s.available ? 1 : 0.6,
              }}
            >
              {s.label}
              {!s.available && (
                <span style={{ ...typo.caption, color: text.faint, marginLeft: spacing.xs }}>
                  {'  '}soon
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
