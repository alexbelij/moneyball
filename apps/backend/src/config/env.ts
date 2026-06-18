/**
 * env | v0.2.0 | 2026-06-17
 * Purpose: Validated environment config with fail-fast for production secrets.
 * T56: production fail-fast — boot throws if JWT_SECRET is missing or insecure.
 */

const DEV_FALLBACK_SECRET = 'dev-insecure-secret-change-me'

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

/**
 * T56: In production, JWT_SECRET MUST be set to a real value.
 * The dev fallback is only allowed when NODE_ENV !== 'production'.
 */
function resolveJwtSecret(): string {
  const raw = process.env.JWT_SECRET
  const isProd = process.env.NODE_ENV === 'production'

  if (isProd && (!raw || raw === DEV_FALLBACK_SECRET)) {
    throw new Error(
      '[FATAL] JWT_SECRET is missing or set to the dev fallback in production. ' +
      'Set a strong secret in your environment before starting the server.',
    )
  }

  return raw ?? DEV_FALLBACK_SECRET
}

export const env = {
  PORT: Number(process.env.PORT ?? 3001),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  CORS_ORIGINS: parseOrigins(process.env.CORS_ORIGINS),

  // Auth/JWT — T56: fail-fast in production
  JWT_SECRET: resolveJwtSecret(),
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
  API_FOOTBALL_KEY: process.env.API_FOOTBALL_KEY ?? '',
  RAPIDAPI_KEY: process.env.RAPIDAPI_KEY ?? '',
  MATCH_POLL_SECONDS: Number(process.env.MATCH_POLL_SECONDS ?? 120),
  PREDICTION_LEAD_HOURS: Number(process.env.PREDICTION_LEAD_HOURS ?? 48),

  // Sleep / evolution triggers (WC pace: a few resolved outcomes per day)
  SLEEP_MIN_RESOLVED: Number(process.env.SLEEP_MIN_RESOLVED ?? 3),
  SLEEP_MIN_MINUTES: Number(process.env.SLEEP_MIN_MINUTES ?? 30),

  // LLM chat (T55) — keys wired to Render by lead, NEVER in repo
  LLM_PRIMARY: process.env.LLM_PRIMARY ?? '',             // 'groq' | 'gemini' | ''
  LLM_FALLBACK: process.env.LLM_FALLBACK ?? '',           // 'groq' | 'gemini' | ''
  GROQ_API_KEY: process.env.GROQ_API_KEY ?? '',
  GROQ_MODEL: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? '',
  GEMINI_MODEL: process.env.GEMINI_MODEL ?? 'gemini-flash-latest',
  LLM_MAX_OUTPUT_TOKENS: Number(process.env.LLM_MAX_OUTPUT_TOKENS ?? 320),
  LLM_TIMEOUT_MS: Number(process.env.LLM_TIMEOUT_MS ?? 8000),
  LLM_USER_MIN_INTERVAL_MS: Number(process.env.LLM_USER_MIN_INTERVAL_MS ?? 4000),
  LLM_DAILY_CAP_PER_USER: Number(process.env.LLM_DAILY_CAP_PER_USER ?? 40),
}
