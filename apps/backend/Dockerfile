# Dockerfile | v1.0.0 | 2026-06-12
# Multi-stage build for @moneyball/backend on Node 20 Alpine.
# Uses tsx to run TypeScript directly — avoids a separate compile step and keeps
# the image simple for a hackathon project. tsx is ~3 MB overhead vs a tsc build.

# ── Stage 1: install ─────────────────────────────────────────────────────
FROM node:20-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# Copy workspace root manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy only the packages we need (backend + shared)
COPY apps/backend/package.json apps/backend/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY sleep-worker/package.json sleep-worker/package.json

RUN pnpm install --frozen-lockfile --prod=false

# ── Stage 2: source ─────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app

# Copy installed deps from stage 1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/sleep-worker/node_modules ./sleep-worker/node_modules

# Copy source
COPY packages/shared/ ./packages/shared/
COPY sleep-worker/ ./sleep-worker/
COPY apps/backend/ ./apps/backend/

# Runtime config
USER app
EXPOSE 3001
ENV NODE_ENV=production
ENV PORT=3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["npx", "tsx", "apps/backend/src/index.ts"]
