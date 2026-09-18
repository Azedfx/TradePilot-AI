#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required (e.g. your Neon Postgres URL)."
  exit 1
fi

echo "→ Applying Prisma schema (db push)…"
./node_modules/.bin/prisma db push --accept-data-loss

API_PORT=3000
WEB_PORT="${PORT:-3001}"

echo "→ Starting NestJS API on :${API_PORT}"
PORT="${API_PORT}" node dist/main.js &
API_PID=$!

echo "→ Starting Next.js web on :${WEB_PORT} (proxy → ${BACKEND_URL:-http://127.0.0.1:3000})"
PORT="${WEB_PORT}" ./node_modules/.bin/next start -p "${WEB_PORT}" &
WEB_PID=$!

shutdown() {
  echo "→ Shutting down…"
  kill "${API_PID}" "${WEB_PID}" 2>/dev/null || true
  wait "${API_PID}" "${WEB_PID}" 2>/dev/null || true
}
trap shutdown INT TERM

# Exit if either process dies
while kill -0 "${API_PID}" 2>/dev/null && kill -0 "${WEB_PID}" 2>/dev/null; do
  sleep 2
done

echo "ERROR: a process exited unexpectedly"
shutdown
exit 1
