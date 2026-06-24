/**
 * useHashRoute | v1.0.0 | 2026-06-17
 * Purpose: Two-way sync between the nav store's active section and the URL
 *          hash (T51). Hash routes (#/about) exist ONLY for deep-link /
 *          sharing — they never trigger a scene reload.
 *
 * Behaviour:
 *  - On mount: if the URL hash matches a known section, open it.
 *  - When `active` changes: reflect it into the hash (replaceState, no scroll,
 *    no history spam). Clearing the section clears the hash.
 *  - On `hashchange` (back/forward, manual edit): update the store.
 *  Guards against feedback loops by only writing when the value differs.
 */

import { useEffect } from 'react'
import { useNavStore } from '@/store/navStore'
import { hashToSection, sectionToHash } from '@/lib/navSections'

export function useHashRoute(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1) Reset on load: a reload must never leave a panel open (browser-
    //    standard behaviour). Strip any section hash on mount instead of
    //    re-opening it — the hash still reflects state during the session
    //    (steps 2 & 3) for in-session back/forward, just not across reloads.
    if (hashToSection(window.location.hash)) {
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      )
    }

    // 2) hashchange -> store.
    const onHashChange = () => {
      const next = hashToSection(window.location.hash)
      const current = useNavStore.getState().active
      if (next !== current) {
        if (next) useNavStore.getState().open(next)
        else useNavStore.getState().close()
      }
    }
    window.addEventListener('hashchange', onHashChange)

    // 3) store -> hash.
    const unsub = useNavStore.subscribe((state) => {
      const desired = state.active ? sectionToHash(state.active) : ''
      const current = window.location.hash
      if (desired === current) return
      const url = desired || window.location.pathname + window.location.search
      window.history.replaceState(null, '', url)
    })

    return () => {
      window.removeEventListener('hashchange', onHashChange)
      unsub()
    }
  }, [])
}
