# TradePilot AI

AI-powered crypto research agent. Ask a natural-language question and it runs a
multi-skill research pipeline (news, market, macro, sentiment, technical) to
produce an investment thesis with historical scenarios and stress tests.

## Structure

```
frontend/          Next.js frontend (App Router)
backend/           NestJS API
  src/
    research/      orchestrator + service + controller + module
    skills/        news, market, macro, sentiment, technical skills
    analysis/      thesis, historical, stress-test services
    llm/           llm.service
    market-data/   market-data.service
    reports/       report.service
    db/            Prisma service, repository, module
  prisma/          schema.prisma (PostgreSQL)
```

## Stack

- **Frontend:** Next.js 16 + React 19 + TypeScript
- **Backend:** NestJS 12 + TypeScript + Prisma ORM
- **Database:** PostgreSQL

## Prerequisites

- Node.js >= 20
- PostgreSQL (or Docker)

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env          # then edit DATABASE_URL
npm install
npx prisma generate           # generate Prisma client
npx prisma db push            # create tables (or npx prisma migrate dev)
npm run start:dev             # http://localhost:3000/api
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev                   # http://localhost:3001
```

Optionally start PostgreSQL via Docker:

```bash
docker compose up -d db
```

## API

| Method | Path              | Description                     |
| ------ | ----------------- | ------------------------------- |
| GET    | `/api/health`     | Health check                    |
| POST   | `/api/research`   | Start a research session        |
| GET    | `/api/research/:id` | Get session status + details  |

Example request:

```json
POST /api/research
{
  "question": "Should I consider buying BTC ahead of the next halving?",
  "symbol": "BTC",
  "timeframe": "30d"
}
```

## Pluggable integrations

Out of the box everything runs on deterministic placeholders so no API keys are
needed:

- `LLM_PROVIDER=placeholder` — swap in a real provider in `llm.service.ts`
- `MARKET_DATA_PROVIDER=placeholder` — swap in Bitget/exchange connectors
- The `skills/*` classes are where real news/on-chain/macro/technical data
  providers plug in.

## Database

Schema lives in `backend/prisma/schema.prisma`. Core tables:

`research_sessions`, `research_plans`, `skill_runs`, `findings`, `sources`,
`historical_events`, `historical_matches`, `theses`, `stress_tests`,
`research_messages`.
