# TradePilot AI — single image: NestJS API (:3000) + Next.js web (:3001)
# Pass DATABASE_URL (Neon) and optional QWEN_API_KEY at runtime.

# ── build ────────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@9

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN pnpm install --frozen-lockfile

COPY . .

# Next rewrites bake this in at build — same-container API
ENV BACKEND_URL=http://127.0.0.1:3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm exec prisma generate \
  && pnpm run build:api \
  && pnpm run build:web

# ── runtime ──────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -r tradepilot \
  && useradd -r -g tradepilot tradepilot

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV BACKEND_URL=http://127.0.0.1:3000
ENV WEB_PORT=3001
ENV CORS_ORIGIN=http://localhost:3001

COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-lock.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./
COPY --from=build /app/server/generated ./server/generated
COPY --from=build /app/next.config.mjs ./
COPY --from=build /app/tsconfig.json ./
COPY docker-entrypoint.sh /app/docker-entrypoint.sh

RUN chmod +x /app/docker-entrypoint.sh \
  && chown -R tradepilot:tradepilot /app

USER tradepilot

EXPOSE 3000 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
