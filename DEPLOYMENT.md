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
   first deploy. You can leave `CORS_ORIGIN` and `BACKEND_URL` blank for now
   — see step 5.
4. Set the Qwen credentials on `tradepilot-api` (from the S2 handbook /
   Qwen Token application):
   - `QWEN_API_KEY` — required for real LLM responses (without it the app
     runs on a deterministic placeholder, which still works but isn't what
     you want for the demo).
   - `QWEN_BASE_URL` / `QWEN_MODEL` are already set in `render.yaml`.
5. Once both services have deployed once, cross-wire their public URLs
   (Render assigns them at first deploy, e.g. `https://tradepilot-api-xxxx.onrender.com`):
   - On `tradepilot-api`, set `CORS_ORIGIN` to the `tradepilot-web` URL.
   - On `tradepilot-web`, set `BACKEND_URL` to the `tradepilot-api` URL.
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

## Sanity-check before submitting

- Open the deployed web URL and run one full research question end to end
  (this is the "complete research task" the form asks for).
- Confirm the self-evolution review panel loads after the run completes.
- Confirm the browser console/network tab shows `/api/*` calls succeeding
  (200s), not `ECONNREFUSED`/CORS errors — if you see CORS errors, double
  check `CORS_ORIGIN` on the API matches the web URL exactly (protocol +
  host, no trailing slash).
