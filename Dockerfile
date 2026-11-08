# GymBrat — obraz produkcyjny Next.js (standalone) na VPS / GHCR.
# Multi-stage, non-root, healthcheck → GET /api/version
# Źródło: github.com/damianchmielewski33-cmyk/GymBrat

ARG NODE_VERSION=20

# --- deps ---
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci
# Lockfile z Windowsa nie zawiera natywnych binarek libsql dla Linux/musl → doinstaluj dla bieżącej architektury.
RUN case "$(apk --print-arch)" in \
      x86_64) PKG=linux-x64-musl ;; \
      aarch64) PKG=linux-arm64-musl ;; \
      *) echo "Nieobslugiwana architektura" && exit 1 ;; \
    esac \
  && V=$(node -p "require('./node_modules/libsql/package.json').version") \
  && npm install --no-save --no-package-lock --ignore-scripts "@libsql/${PKG}@${V}"

# --- build ---
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Build-time public URL (nadpisywane w runtime przez env kontenera)
ARG NEXT_PUBLIC_APP_URL=
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

RUN npm run build

# --- runner ---
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache libc6-compat wget \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Natywna binarka libsql ładowana dynamicznie (nie zawsze w trace standalone)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@libsql ./node_modules/@libsql

# Migracje Drizzle (instrumentation / outputFileTracingIncludes)
COPY --from=builder --chown=nextjs:nodejs /app/db/migrations ./db/migrations

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/version" >/dev/null || exit 1

CMD ["node", "server.js"]
