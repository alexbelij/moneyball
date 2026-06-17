/**
 * navStore | v1.0.0 | 2026-06-17
 * Purpose: Overlay-navigation state (T51). Holds the active section and the
 *          pixel-menu open flag. Pure state only — hash <-> store syncing is
 *          done by the useHashRoute hook so the store stays testable.
 */

import { create } from 'zustand'
import type { SectionId } from '@/lib/navSections'

interface NavState {
  /** Currently open overlay section, or null when the cabinet is clear. */
  active: SectionId | null
  /** Whether the pixel menu dropdown is open. */
  menuOpen: boolean
  open: (id: SectionId) => void
  close: () => void
  toggleMenu: () => void
  setMenuOpen: (open: boolean) => void
}

export const useNavStore = create<NavState>()((set) => ({
  active: null,
  menuOpen: false,
  // Opening a section also closes the menu dropdown.
  open: (id) => set({ active: id, menuOpen: false }),
  close: () => set({ active: null }),
  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),
  setMenuOpen: (open) => set({ menuOpen: open }),
}))
