/**
 * config | v0.2.0 | 2026-06-09
 */

function requireEnv(name: string): string {
  const v = (import.meta as any).env?.[name] as string | undefined
  if (!v) throw new Error(`Missing ${name}. Create apps/frontend/.env and set ${name}.`)
  return v
}

export const config = {
  backendUrl: requireEnv('VITE_BACKEND_URL'),
  enableAdminDemo: ((import.meta as any).env?.VITE_ENABLE_ADMIN_DEMO ?? 'false') === 'true',
  debugWallet: ((import.meta as any).env?.VITE_DEBUG_WALLET ?? 'false') === 'true',
}
