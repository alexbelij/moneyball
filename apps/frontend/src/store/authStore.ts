/**
 * authStore | v0.1.0 | 2026-06-09
 * Purpose: Persist JWT + viewer role client-side.
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

export type ViewerRole = 'user' | 'admin'
export type Viewer = { suiAddress: string; role: ViewerRole; exp?: number }

type AuthState = {
  token: string | null
  viewer: Viewer | null
  setAuth: (token: string, viewer: Viewer) => void
  clearAuth: () => void
}

const KEY = 'moneyball.jwt'

function parseJwt(token: string): any | null {
  try { return JSON.parse(atob(token.split('.')[1])) } catch { return null }
}

const persisted = localStorage.getItem(KEY)
const payload = persisted ? parseJwt(persisted) : null
const viewer: Viewer | null =
  payload?.sub && payload?.role ? { suiAddress: String(payload.sub), role: payload.role, exp: payload.exp } : null

export const useAuthStore = create<AuthState>()(
  devtools(
    immer((set) => ({
      token: viewer ? persisted : null,
      viewer,
      setAuth: (token, viewer) => set((s) => {
        localStorage.setItem(KEY, token)
        s.token = token
        s.viewer = viewer
      }),
      clearAuth: () => set((s) => {
        localStorage.removeItem(KEY)
        s.token = null
        s.viewer = null
      }),
    })),
  ),
)
