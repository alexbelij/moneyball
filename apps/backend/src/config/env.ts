function parseOrigins(value: string | undefined): string[] {
  if (!value) return []
  return value.split(',').map(s => s.trim()).filter(Boolean)
}

function parseAllowlist(value: string | undefined): Set<string> {
  if (!value) return new Set()
  return new Set(
    value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  )
}

export const env = {
  PORT: Number(process.env.PORT ?? 3001),
  CORS_ORIGINS: parseOrigins(process.env.CORS_ORIGINS),

  // Auth/JWT
  JWT_SECRET: process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me',
  AUTH_NONCE_TTL_MS: Number(process.env.AUTH_NONCE_TTL_MS ?? 5 * 60_000),
  AUTH_DOMAIN: process.env.AUTH_DOMAIN ?? 'localhost',
  AUTH_URI: process.env.AUTH_URI ?? 'http://localhost:3000',

  // Admin
  ADMIN_ALLOWLIST: parseAllowlist(process.env.ADMIN_ALLOWLIST),

  // Storage
  STORAGE_BACKEND: (process.env.STORAGE_BACKEND ?? 'file') as 'file' | 'memwal',
  MEMWAL_KEY: process.env.MEMWAL_KEY ?? '',
  MEMWAL_ACCOUNT_ID: process.env.MEMWAL_ACCOUNT_ID ?? '',
  MEMWAL_RELAYER: process.env.MEMWAL_RELAYER ?? 'https://relayer.memory.walrus.xyz',
  MEMWAL_NAMESPACE: process.env.MEMWAL_NAMESPACE ?? 'moneyball',

  // Match pipeline
  MATCH_SOURCE: (process.env.MATCH_SOURCE ??
    (process.env.FOOTBALL_DATA_TOKEN ? 'football-data' : 'manual')) as 'football-data' | 'manual',
  FOOTBALL_DATA_TOKEN: process.env.FOOTBALL_DATA_TOKEN ?? '',
  MATCH_POLL_SECONDS: Number(process.env.MATCH_POLL_SECONDS ?? 120),
  PREDICTION_LEAD_HOURS: Number(process.env.PREDICTION_LEAD_HOURS ?? 48),

  // Sleep / evolution triggers (WC pace: a few resolved outcomes per day)
  SLEEP_MIN_RESOLVED: Number(process.env.SLEEP_MIN_RESOLVED ?? 3),
  SLEEP_MIN_MINUTES: Number(process.env.SLEEP_MIN_MINUTES ?? 30),
}
