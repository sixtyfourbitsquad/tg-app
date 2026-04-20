# ─── Stage 1: deps ────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
# openssl is required by Prisma to detect the right engine target during
# `prisma generate`; libc6-compat smooths over musl vs glibc edges.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# ─── Stage 2: builder ─────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client (needs openssl installed above so the engine target
# is detected as linux-musl-openssl-3.0.x instead of the default 1.1.x).
RUN npx prisma generate

# Build Next.js.
#
# NOTE: Next.js inlines `process.env.X` into compiled server bundles when X is
# resolvable at build time. For the videos route in particular, an unresolved
# VIDEOS_DIR got folded to its fallback string ("/home/adii/videos") and no
# amount of runtime env tweaking could undo it. Freeze the canonical Docker
# path at build time so the inlined value matches what the container actually
# mounts at runtime.
ENV NEXT_TELEMETRY_DISABLED=1
ENV VIDEOS_DIR=/app/videos-data
RUN npm run build

# ─── Stage 3: runner ──────────────────────────────────────────────────────
FROM node:20-alpine AS runner
# openssl is required at runtime so Prisma's query engine shared library
# (libquery_engine-linux-musl-openssl-3.0.x.so.node) can dlopen libssl.so.3.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema + CLI + engines for runtime migrations.
# Without node_modules/prisma the CLI would be pulled from the registry on
# every `npx prisma …` call, which is both slow and, on Prisma 7+, incompatible
# with our v5-era schema syntax. Pin everything at build time instead.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# Bundled maintenance scripts (see builder stage for the esbuild step).
# Run from inside the container with e.g.
#   docker compose exec app node scripts/bulk-upload.cjs /app/videos-data
COPY --from=builder --chown=nextjs:nodejs /app/scripts/bulk-upload.cjs ./scripts/bulk-upload.cjs

# Create logs dir
RUN mkdir -p /app/logs && chown nextjs:nodejs /app/logs

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
