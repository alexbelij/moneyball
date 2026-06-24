/**
 * useJudgeRoute | v1.0.0 | 2026-06-24
 * Purpose: Two-way sync between the judge store and the URL hash (#/judge).
 *
 * Unlike useHashRoute (which strips section hashes on reload so a refresh never
 * leaves a panel open), the judge page is a shareable deep link for jurors:
 *  - On mount: if the hash is '#/judge', OPEN the overlay.
 *  - On hashchange (back/forward/manual): mirror into the store.
 *  - When the store opens: write '#/judge'. When it closes: clear the hash,
 *    but ONLY if the current hash is the judge hash — never clobber a section
 *    hash owned by useHashRoute.
 */

import { useEffect } from 'react'
import { useJudgeStore } from '@/store/judgeStore'
import { isJudgeHash, JUDGE_HASH } from '@/lib/judgeRoute'

export function useJudgeRoute(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1) Deep-link open on cold load.
    if (isJudgeHash(window.location.hash)) {
      useJudgeStore.getState().openJudge()
    }

    // 2) hashchange -> store.
    const onHashChange = () => {
      const wantOpen = isJudgeHash(window.location.hash)
      const isOpen = useJudgeStore.getState().open
      if (wantOpen && !isOpen) useJudgeStore.getState().openJudge()
      else if (!wantOpen && isOpen) useJudgeStore.getState().closeJudge()
    }
    window.addEventListener('hashchange', onHashChange)

    // 3) store -> hash.
    const unsub = useJudgeStore.subscribe((state) => {
      const hashIsJudge = isJudgeHash(window.location.hash)
      if (state.open && !hashIsJudge) {
        window.history.replaceState(null, '', JUDGE_HASH)
      } else if (!state.open && hashIsJudge) {
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search,
        )
      }
    })

    return () => {
      window.removeEventListener('hashchange', onHashChange)
      unsub()
    }
  }, [])
}
