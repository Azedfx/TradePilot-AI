#!/bin/sh
set -eu

echo "=== DEBUG ==="
echo "PORT=${PORT:-unset}"
echo "WEB_PORT=${WEB_PORT:-unset}"
echo "API_PORT=${API_PORT:-unset}"
echo "ls .next/server/app/page.js: $(ls .next/server/app/page.js 2>&1)"
echo "ls .next/required-server-files.json: $(ls .next/required-server-files.json 2>&1)"
echo "============="

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required (e.g. your Neon Postgres URL)."
  exit 1
fi

echo "→ Applying Prisma schema (db push)…"
./node_modules/.bin/prisma db push --accept-data-loss

WEB_PORT="${PORT:-3001}"
API_PORT=3000
if [ "$API_PORT" = "$WEB_PORT" ]; then API_PORT=3002; fi

echo "WEB_PORT=${WEB_PORT} API_PORT=${API_PORT}"

# Update rewrite URLs if API port differs from default 3000
if [ "$API_PORT" != "3000" ]; then
  echo "Updating rewrite URLs to API port ${API_PORT}"
  sed -i "s|http://localhost:3000|http://127.0.0.1:${API_PORT}|g" .next/required-server-files.json 2>/dev/null
  sed -i "s|http://127.0.0.1:3000|http://127.0.0.1:${API_PORT}|g" .next/required-server-files.json 2>/dev/null
  sed -i "s|http://localhost:3000|http://127.0.0.1:${API_PORT}|g" .next/routes-manifest.json 2>/dev/null
  sed -i "s|http://127.0.0.1:3000|http://127.0.0.1:${API_PORT}|g" .next/routes-manifest.json 2>/dev/null
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

# Exit if either process dies
while kill -0 "${API_PID}" 2>/dev/null && kill -0 "${WEB_PID}" 2>/dev/null; do
  sleep 2
done

echo "ERROR: a process exited unexpectedly"
shutdown
exit 1
