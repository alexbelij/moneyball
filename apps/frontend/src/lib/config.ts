/**
 * config | v0.3.0 | 2026-06-24
 *
 * Central runtime config. backendUrl is resolved with a resilient fallback so a
 * missing VITE_BACKEND_URL at build time can NEVER blank the whole app:
 * previously requireEnv() threw at module-eval, which crashed main.tsx before
 * React mounted and left an empty <div id="root"> (the Vercel symptom).
 *
 * Resolution order for backendUrl:
 *   1. VITE_BACKEND_URL (build-time env) — always wins when set.
 *   2. Dev: the current page origin (so the Vite dev-server mock at /api/*
 *      intercepts requests on the same origin).
 *   3. Prod: the live backend on Render.
 */

const env = (import.meta as any).env ?? {}

/** Live backend (public, also in MONEYBALL_CONTEXT). Used as prod fallback. */
const PROD_BACKEND_URL = 'https://taken-api.onrender.com'

function resolveBackendUrl(): string {
  const explicit = env.VITE_BACKEND_URL as string | undefined
  if (explicit && explicit.trim()) return explicit.trim()

  if (env.DEV) {
    // Same-origin so the dev-server mock plugin (/api/*) intercepts.
    return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
  }

  // Production build without an explicit override → talk to the live backend.
  if (typeof console !== 'undefined') {
    console.warn(`[config] VITE_BACKEND_URL not set — falling back to ${PROD_BACKEND_URL}`)
  }
  return PROD_BACKEND_URL
}

export const config = {
  backendUrl: resolveBackendUrl(),
  enableAdminDemo: (env.VITE_ENABLE_ADMIN_DEMO ?? 'false') === 'true',
  debugWallet: (env.VITE_DEBUG_WALLET ?? 'false') === 'true',
}
