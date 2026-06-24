/**
 * judgeStore | v1.0.0 | 2026-06-24
 * Purpose: Tiny state for the "For Judges" overlay (#/judge). Kept separate
 *          from navStore so the judge page can DEEP-LINK open on load — unlike
 *          nav sections, which intentionally close on reload. Pure state only;
 *          hash <-> store syncing lives in the useJudgeRoute hook so the store
 *          stays trivially testable.
 */

import { create } from 'zustand'

interface JudgeState {
  /** Whether the judge overlay is open. */
  open: boolean
  openJudge: () => void
  closeJudge: () => void
}

export const useJudgeStore = create<JudgeState>()((set) => ({
  open: false,
  openJudge: () => set({ open: true }),
  closeJudge: () => set({ open: false }),
}))
