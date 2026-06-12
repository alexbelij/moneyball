/**
 * useRovingTabs.ts | v1.0.0 | 2026-06-12
 * Purpose: Roving tabindex for WAI-ARIA Tabs pattern.
 * ArrowLeft/Right cycle through tabs, Home/End jump to first/last.
 * Only the active tab has tabindex=0; others have tabindex=-1.
 */

import { useCallback, useRef } from 'react'

interface UseRovingTabsOptions<T extends string> {
  /** Ordered list of tab IDs. */
  tabs: readonly T[]
  /** Currently selected tab. */
  activeTab: T
  /** Called when selection changes via keyboard. */
  onSelect: (tab: T) => void
  /** Orientation: 'horizontal' (default) or 'vertical'. */
  orientation?: 'horizontal' | 'vertical'
}

export function useRovingTabs<T extends string>(options: UseRovingTabsOptions<T>) {
  const { tabs, activeTab, onSelect, orientation = 'horizontal' } = options
  const tabRefs = useRef<Map<T, HTMLElement>>(new Map())

  const registerTab = useCallback(
    (tabId: T) => (el: HTMLElement | null) => {
      if (el) {
        tabRefs.current.set(tabId, el)
      } else {
        tabRefs.current.delete(tabId)
      }
    },
    [],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const prevKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp'
      const nextKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown'

      const idx = tabs.indexOf(activeTab)
      if (idx === -1) return

      let nextIdx: number | null = null

      switch (e.key) {
        case nextKey:
          nextIdx = (idx + 1) % tabs.length
          break
        case prevKey:
          nextIdx = (idx - 1 + tabs.length) % tabs.length
          break
        case 'Home':
          nextIdx = 0
          break
        case 'End':
          nextIdx = tabs.length - 1
          break
        default:
          return
      }

      e.preventDefault()
      const nextTab = tabs[nextIdx]
      onSelect(nextTab)

      // Focus the newly selected tab
      const el = tabRefs.current.get(nextTab)
      if (el) el.focus()
    },
    [tabs, activeTab, onSelect, orientation],
  )

  const getTabProps = useCallback(
    (tabId: T) => ({
      ref: registerTab(tabId),
      role: 'tab' as const,
      id: `tab-${tabId}`,
      'aria-selected': tabId === activeTab,
      'aria-controls': `tabpanel-${tabId}`,
      tabIndex: tabId === activeTab ? 0 : -1,
      onKeyDown: handleKeyDown,
    }),
    [activeTab, registerTab, handleKeyDown],
  )

  const getTabPanelProps = useCallback(
    (tabId: T) => ({
      role: 'tabpanel' as const,
      id: `tabpanel-${tabId}`,
      'aria-labelledby': `tab-${tabId}`,
      tabIndex: 0,
    }),
    [],
  )

  const getTabListProps = useCallback(
    () => ({
      role: 'tablist' as const,
      'aria-orientation': orientation,
    }),
    [orientation],
  )

  return { getTabProps, getTabPanelProps, getTabListProps }
}
