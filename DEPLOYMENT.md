# Deploying an Accessible Demo

Track 3 requires an **accessible Demo** — a localhost URL doesn't count.
This app is NestJS API + Next.js frontend + Postgres. On Render we run **API and
web in one service** so a single public URL serves the dashboard and proxies
`/api/*` to Nest (same pattern as the Docker image).

## Option A — Render Blueprint (recommended)

1. Push this repo to GitHub (Render deploys from a Git repo).
2. In the Render dashboard: **New → Blueprint**, point it at this repo. It
   will read `render.yaml` and create:
   - `tradepilot-db` (free Postgres)
   - `tradepilot-ai` (Next.js + NestJS; `prisma db push` on boot)
3. Render will prompt for env vars marked `sync: false`. Set `QWEN_API_KEY`
   (and optionally `MCP_URL` / `BITGET_US_MCP_URL`). Leave `PORT` unset — Render injects it.
4. After deploy, open the **service root URL** (not `/api`) — that is your
   Accessible Demo link. Health check: `/api/health`.

### Already have an API-only Render service?

Update that service's settings and redeploy:

| Setting | Value |
| --- | --- |
| Build command | `pnpm install && pnpm run build:render` |
| Start command | `pnpm run start:render` |
| `PORT` | **unset** (do not set `3000`) |
| `BACKEND_URL` | `http://127.0.0.1:3000` (needed at **build** and runtime) |

Do not set `PORT=3000` — Nest uses internal `3000` on **loopback only**; Next must bind Render's `$PORT` on `0.0.0.0` so Render routes public traffic to the dashboard.

## Option B — Split providers (Vercel for web + Render/Railway for API)

If you'd rather use Vercel for the frontend specifically:

1. Deploy the API (+ Postgres) on Render/Railway with `npm run build:api` /
   `npm run start:api` (`prisma db push` first).
2. Import the repo into Vercel for the frontend. Set the **Root Directory**
   to the repo root (this is a single-repo project, not a monorepo) and:
   - Build command: `npm run build:web`
   - Set `BACKEND_URL` in Vercel's project env vars to the API's public URL
     (e.g. `https://your-api.onrender.com`, no trailing slash).
3. Set `CORS_ORIGIN` on the API to the Vercel deployment URL.

## Required environment variables

| Var | Notes |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `QWEN_API_KEY` | From the S2 Qwen Token application; without it the LLM falls back to a placeholder |
| `QWEN_BASE_URL` | `https://hackathon.bitgetops.com/v1` |
| `QWEN_MODEL` | `qwen3.8-max` |
| `MCP_URL` | Optional; bitget-signal datahub MCP (macro/news/sentiment/TA) |
| `BITGET_US_MCP_URL` | Optional; bitget-mcp-server US quotes/fundamentals (`https://agent.bitget.com/mcp`) |
| `BACKEND_URL` | Same-box: `http://127.0.0.1:3000`. Split deploy: public API URL |
| `CORS_ORIGIN` | Public demo URL (less critical when Next proxies `/api` same-origin) |
| `PORT` | Set automatically by the host — **do not hardcode `3000` on Render** |

## Docker (single image: API + web)

```bash
docker build -t tradepilot-ai .

docker run --rm -p 3001:3001 \
  -e DATABASE_URL="postgresql://…neon.tech/neondb?sslmode=require" \
  -e QWEN_API_KEY="your-key" \
  -e QWEN_BASE_URL="https://hackathon.bitgetops.com/v1" \
  -e QWEN_MODEL="qwen3.8-max" \
  -e CORS_ORIGIN="http://localhost:3001" \
  tradepilot-ai
```

Open **http://localhost:3001** (Next proxies `/api/*` to the Nest API inside the same container). Port 3000 does not need to be published.
