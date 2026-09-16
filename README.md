# TradePilot AI

AI-powered research workbench for US equities, tokenized US stocks (rTokens),
and crypto. Ask a natural-language question and it runs a multi-skill research
pipeline (news, market, macro, sentiment, technical) to produce an investment
thesis with historical scenarios, stress tests, and a self-evolution review —
while a human trader makes the final call.

Built for **Bitget AI Base Camp Hackathon S2 — Track 3: AI Trading Desk (AI
Research Workbench)**, sub-theme **Review & Self-Evolution** — *"After
trading, how does AI help the trader review and iterate their research
framework?"*

The self-evolution loop lives in `server/review/` + `src/components/research/SelfReview.tsx`:
after a research run completes, it auto-generates a review report that (1)
flags bad-decision patterns in *this* session (e.g. a stop tighter than the
worst-case stress drawdown, a macro-driven thesis that never establishes the
7×24 rToken weekend-transmission chain, incomplete skill coverage), (2)
cross-checks those same pattern IDs against the trader's **recent past
sessions** to surface genuinely recurring mistakes ("repeated in 3/8 of your
recent reviewed sessions"), and (3) emits a reusable checklist for the next
idea. See `GET /api/review/:sessionId`.

## Structure

This is a single repo with two apps that run together via `npm run dev`
(`concurrently`):

```
src/               Next.js frontend (App Router), served on :3001
  app/              routes/layout
  components/       research/ (thesis, stress tests, review, evidence...), views/, layout/, ui/
  lib/              api client, research context, shared types

server/            NestJS API, served on :3000 (proxied by Next.js under /api)
  research/         orchestrator + service + controller + module
  skills/           news, market, macro, sentiment, technical skills
  analysis/         thesis, historical, stress-test services
  review/           self-evolution review (bad-decision patterns + reusable checklist)
  llm/              llm.service (Qwen via Bitget hackathon proxy, placeholder fallback)
  market-data/      market-data.service, MCP client (Bitget datahub)
  reports/          report.service
  db/               Prisma service, repository, module
  prisma/           schema.prisma (PostgreSQL)
```

Next.js proxies `/api/*` to the NestJS server (`BACKEND_URL`, defaults to
`http://localhost:3000`) — see `next.config.mjs`.

## Stack

- **Frontend:** Next.js 16 + React 19 + TypeScript
- **Backend:** NestJS 12 + TypeScript + Prisma ORM
- **Database:** PostgreSQL
- **LLM:** Qwen (`qwen3.8-max`) via the Bitget hackathon proxy, deterministic
  placeholder fallback when no API key is set

## Prerequisites

- Node.js >= 20
- PostgreSQL (or Docker)

## Setup

```bash
cp .env.example .env          # edit DATABASE_URL, QWEN_API_KEY, etc.
npm install
npx prisma generate
npx prisma db push            # create tables (or npx prisma migrate dev)
npm run dev                   # starts both API (:3000) and web (:3001)
```

Optionally start PostgreSQL via Docker:

```bash
docker compose up -d db
```

## API

| Method | Path                       | Description                          |
| ------ | --------------------------- | ------------------------------------- |
| GET    | `/api/health`               | Health check                          |
| POST   | `/api/research`              | Start a research session              |
| GET    | `/api/research`              | List recent research sessions         |
| GET    | `/api/research/:id`          | Get session status + full details     |
| GET    | `/api/review/:sessionId`     | Self-evolution review report          |
| GET    | `/api/review/:sessionId/checklist` | Reusable checklist for the next idea |
| GET    | `/api/market/:symbol`        | Live market snapshot for a symbol     |

Example request:

```json
POST /api/research
{
  "question": "Should I consider buying NVDA ahead of earnings?",
  "symbol": "NVDA",
  "timeframe": "30d"
}
```

## Pluggable integrations

- `LLM_PROVIDER` — `qwen` when `QWEN_API_KEY` is set, otherwise a
  deterministic placeholder so the app runs without keys. Swap in another
  provider in `server/llm/llm.service.ts`.
- `MCP_URL` — Bitget datahub MCP server for macro/market/stock data
  (`server/market-data/mcp-client.service.ts`); skills fall back to direct
  APIs (Bitget, Yahoo Finance) if MCP is unavailable.
- The `server/skills/*` classes are where additional real-time data
  providers plug in.

## Database

Schema lives in `prisma/schema.prisma`. Core tables:

`research_sessions`, `research_plans`, `skill_runs`, `findings`, `sources`,
`historical_events`, `historical_matches`, `theses`, `stress_tests`,
`research_messages`.
