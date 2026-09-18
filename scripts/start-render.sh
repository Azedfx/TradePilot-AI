#!/bin/sh
# Single-service boot: NestJS API (internal) + Next.js web (public $PORT).
# Used by Render (`pnpm run start:render`) and Docker (`docker-entrypoint.sh`).
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

echo "→ Starting NestJS API on :${API_PORT}"
PORT="${API_PORT}" node dist/main.js &
API_PID=$!

echo "→ Starting Next.js web on :${WEB_PORT} (proxy → http://127.0.0.1:${API_PORT})"
PORT="${WEB_PORT}" ./node_modules/.bin/next start -p "${WEB_PORT}" &
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
