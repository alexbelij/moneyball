/**
 * a11y.test.tsx | v1.0.0 | 2026-06-12
 * Purpose: Tests for focus trap, roving tabs, and AgentModal a11y attributes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import React, { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useFocusTrap } from '@/lib/a11y/useFocusTrap'
import { useRovingTabs } from '@/lib/a11y/useRovingTabs'

/* ── useFocusTrap ───────────────────────────────────────────────────────── */

function TrapHarness({ onClose }: { onClose: () => void }) {
  const ref = useFocusTrap<HTMLDivElement>({ onClose })
  return (
    <div ref={ref} data-testid="trap">
      <button>First</button>
      <button>Second</button>
      <button>Third</button>
    </div>
  )
}

describe('useFocusTrap', () => {
  it('focuses first focusable element on mount', async () => {
    render(<TrapHarness onClose={() => {}} />)
    // requestAnimationFrame needs a tick
    await new Promise((r) => setTimeout(r, 50))
    expect(document.activeElement).toBe(screen.getByText('First'))
  })

  it('wraps focus from last to first on Tab', async () => {
    const user = userEvent.setup()
    render(<TrapHarness onClose={() => {}} />)
    await new Promise((r) => setTimeout(r, 50))

    // Focus Third
    screen.getByText('Third').focus()
    await user.keyboard('{Tab}')
    expect(document.activeElement).toBe(screen.getByText('First'))
  })

  it('wraps focus from first to last on Shift+Tab', async () => {
    const user = userEvent.setup()
    render(<TrapHarness onClose={() => {}} />)
    await new Promise((r) => setTimeout(r, 50))

    screen.getByText('First').focus()
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(document.activeElement).toBe(screen.getByText('Third'))
  })

  it('calls onClose on Escape', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<TrapHarness onClose={onClose} />)
    await new Promise((r) => setTimeout(r, 50))

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })
})

/* ── useRovingTabs ──────────────────────────────────────────────────────── */

const TABS = ['alpha', 'beta', 'gamma'] as const

function TabsHarness() {
  const [active, setActive] = useState<(typeof TABS)[number]>('alpha')
  const { getTabProps, getTabPanelProps, getTabListProps } = useRovingTabs({
    tabs: TABS,
    activeTab: active,
    onSelect: setActive,
  })

  return (
    <div>
      <div {...getTabListProps()}>
        {TABS.map((t) => (
          <button key={t} {...getTabProps(t)} onClick={() => setActive(t)}>
            {t}
          </button>
        ))}
      </div>
      <div {...getTabPanelProps(active)}>
        Content: {active}
      </div>
    </div>
  )
}

describe('useRovingTabs', () => {
  it('renders tablist, tabs, and tabpanel with correct ARIA', () => {
    render(<TabsHarness />)
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    expect(screen.getByRole('tabpanel')).toBeInTheDocument()
  })

  it('active tab has aria-selected=true, others false', () => {
    render(<TabsHarness />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false')
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false')
  })

  it('only active tab has tabindex=0', () => {
    render(<TabsHarness />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0]).toHaveAttribute('tabindex', '0')
    expect(tabs[1]).toHaveAttribute('tabindex', '-1')
  })

  it('ArrowRight moves to next tab', async () => {
    const user = userEvent.setup()
    render(<TabsHarness />)
    const tabs = screen.getAllByRole('tab')

    tabs[0].focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByText('Content: beta')).toBeInTheDocument()
  })

  it('ArrowLeft wraps from first to last', async () => {
    const user = userEvent.setup()
    render(<TabsHarness />)
    const tabs = screen.getAllByRole('tab')

    tabs[0].focus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByText('Content: gamma')).toBeInTheDocument()
  })

  it('Home goes to first, End goes to last', async () => {
    const user = userEvent.setup()
    render(<TabsHarness />)
    const tabs = screen.getAllByRole('tab')

    tabs[0].focus()
    await user.keyboard('{ArrowRight}') // beta
    await user.keyboard('{End}')
    expect(screen.getByText('Content: gamma')).toBeInTheDocument()

    await user.keyboard('{Home}')
    expect(screen.getByText('Content: alpha')).toBeInTheDocument()
  })

  it('tab has aria-controls pointing to tabpanel id', () => {
    render(<TabsHarness />)
    const tab = screen.getAllByRole('tab')[0]
    const panel = screen.getByRole('tabpanel')
    expect(tab.getAttribute('aria-controls')).toBe(panel.id)
  })
})
