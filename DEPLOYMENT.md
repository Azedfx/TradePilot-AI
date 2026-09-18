# Deploying an Accessible Demo

Track 3 requires an **accessible Demo** — a localhost URL doesn't count.
This app has two services (NestJS API + Postgres, Next.js frontend), so the
easiest path is to deploy both on the same provider and wire the two public
URLs to each other. These steps use [Render](https://render.com) via the
included `render.yaml` blueprint, but Railway/Fly.io work the same way if you
prefer them — the important part is the order of operations below.

## Option A — Render Blueprint (recommended, one provider)

1. Push this repo to GitHub (Render deploys from a Git repo).
2. In the Render dashboard: **New → Blueprint**, point it at this repo. It
   will read `render.yaml` and create three resources:
   - `tradepilot-db` (free Postgres)
   - `tradepilot-api` (NestJS, runs `prisma db push` on boot to apply the schema)
   - `tradepilot-web` (Next.js)
3. Render will prompt for the env vars marked `sync: false` before the
    first deploy. Only `QWEN_API_KEY` and `MCP_URL` need to be set.
    `CORS_ORIGIN` and `BACKEND_URL` are automatically wired between
    services via `fromService`.
   - Trigger a manual redeploy of both so the env vars take effect.
6. Visit the `tradepilot-web` URL — that's your Accessible Demo link for
   the submission form.

## Option B — Split providers (Vercel for web + Render/Railway for API)

If you'd rather use Vercel for the frontend specifically:

1. Deploy `tradepilot-api` (+ Postgres) on Render/Railway as above, using
   `npm run build:api` / `npm run start:api` (`prisma db push` first).
2. Import the repo into Vercel for the frontend. Set the **Root Directory**
   to the repo root (this is a single-repo project, not a monorepo) and:
   - Build command: `npm run build:web`
   - Set `BACKEND_URL` in Vercel's project env vars to the API's public URL.
3. Set `CORS_ORIGIN` on the API to the Vercel deployment URL.

## Required environment variables

| Var | Service | Notes |
| --- | --- | --- |
| `DATABASE_URL` | API | Postgres connection string |
| `QWEN_API_KEY` | API | From the S2 Qwen Token application; without it the LLM falls back to a placeholder |
| `QWEN_BASE_URL` | API | `https://hackathon.bitgetops.com/v1` |
| `QWEN_MODEL` | API | `qwen3.8-max` |
| `MCP_URL` | API | Optional; Bitget datahub MCP server for macro/market data |
| `CORS_ORIGIN` | API | Public URL of the deployed frontend |
| `BACKEND_URL` | Web | Public URL of the deployed API (used by the `/api/*` rewrite in `next.config.mjs`) |
| `PORT` | Both | Set automatically by the host; `server/main.ts` and `start:web` both honor it |

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

