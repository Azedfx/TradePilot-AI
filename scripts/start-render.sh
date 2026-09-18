#!/bin/sh
# Single-service boot: NestJS API (loopback only) + Next.js web (public $PORT).
# Used by Render (`pnpm run start:render`) and Docker (`docker-entrypoint.sh`).
#
# Nest must NOT bind 0.0.0.0 — Render will otherwise treat :3000 as the public
# HTTP server and mis-route traffic away from Next on $PORT (often 10000).
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required."
  exit 1
fi

echo "→ Applying Prisma schema (db push)…"
./node_modules/.bin/prisma db push --accept-data-loss

WEB_PORT="${PORT:-3001}"
API_PORT=3000
if [ "$API_PORT" = "$WEB_PORT" ]; then
  API_PORT=3002
fi

echo "WEB_PORT=${WEB_PORT} API_PORT=${API_PORT}"

# Next rewrites bake BACKEND_URL at build time; patch if API port drifted.
if [ "$API_PORT" != "3000" ]; then
  echo "Updating rewrite URLs to API port ${API_PORT}"
  for f in .next/required-server-files.json .next/routes-manifest.json; do
    if [ -f "$f" ]; then
      sed -i "s|http://localhost:3000|http://127.0.0.1:${API_PORT}|g" "$f"
      sed -i "s|http://127.0.0.1:3000|http://127.0.0.1:${API_PORT}|g" "$f"
    fi
  done
fi

echo "→ Starting NestJS API on 127.0.0.1:${API_PORT} (private)"
HOST=127.0.0.1 PORT="${API_PORT}" node dist/main.js &
API_PID=$!

# Brief wait so Nest is accepting before Next starts proxying /api/*
i=0
while [ "$i" -lt 30 ]; do
  if node -e "fetch('http://127.0.0.1:${API_PORT}/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    break
  fi
  i=$((i + 1))
  sleep 1
done

echo "→ Starting Next.js web on 0.0.0.0:${WEB_PORT} (public; proxy → http://127.0.0.1:${API_PORT})"
PORT="${WEB_PORT}" ./node_modules/.bin/next start -H 0.0.0.0 -p "${WEB_PORT}" &
WEB_PID=$!

shutdown() {
  echo "→ Shutting down…"
  kill "${API_PID}" "${WEB_PID}" 2>/dev/null || true
  wait "${API_PID}" "${WEB_PID}" 2>/dev/null || true
}
trap shutdown INT TERM

while kill -0 "${API_PID}" 2>/dev/null && kill -0 "${WEB_PID}" 2>/dev/null; do
  sleep 2
done

echo "ERROR: a process exited unexpectedly"
shutdown
exit 1
