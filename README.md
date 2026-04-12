# Investment Tracker

A full-stack professional investment portfolio tracking system.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Auth | JWT + Refresh Tokens |
| State | Zustand + React Query |
| Charts | Recharts |
| Package manager | pnpm workspaces |

## Project Structure

```
investment-tracker/
├── apps/
│   ├── api/          # NestJS backend (port 3001)
│   └── web/          # Next.js frontend (port 3000)
├── packages/
│   └── shared/       # Shared TypeScript types/constants
├── prisma/
│   ├── schema.prisma # Database schema
│   └── seed.ts       # Demo data seed
├── docker-compose.yml
├── .env.example
└── README.md
```

## Quick Start

### 1. Prerequisites

- Node.js ≥ 20
- pnpm ≥ 8 → `npm install -g pnpm`
- Docker + Docker Compose

### 2. Setup

```bash
cd investment-tracker

# Install dependencies
pnpm install

# Start PostgreSQL + Redis
docker-compose up -d

# Copy and edit environment files
cp .env.example .env
# IMPORTANT: open .env and set:
#   JWT_ACCESS_SECRET  (random string, min 32 chars)
#   JWT_REFRESH_SECRET (random string, min 32 chars)
#   ENCRYPTION_KEY     (exactly 32 chars)

# Frontend env
echo "NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1" > apps/web/.env.local
```

### 3. Database

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations (creates all tables)
pnpm db:migrate

# Seed demo data (creates demo user + 7 assets + transactions + mock quotes)
pnpm db:seed
```

### 4. Run

```bash
# Run both API and web simultaneously
pnpm dev

# Or individually:
pnpm --filter api dev      # API → http://localhost:3001/api/v1
pnpm --filter web dev      # Web → http://localhost:3000
```

### 5. Verify

```bash
# Health check
curl http://localhost:3001/api/v1/health
# Expected: { "status": "ok", "services": { "database": "up" } }
```

### 6. Demo login

```
URL:      http://localhost:3000
Email:    demo@example.com
Password: Demo123!
```

### 7. Run tests

```bash
pnpm --filter api test
# or with coverage:
pnpm --filter api test:cov
```

### 8. Build for production

```bash
pnpm build

# API: apps/api/dist/main.js
# Web: apps/web/.next/
```

## API Overview

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password

GET    /api/v1/users/me
PATCH  /api/v1/users/me
PATCH  /api/v1/users/me/settings

GET    /api/v1/portfolios
POST   /api/v1/portfolios
GET    /api/v1/portfolios/:id/summary
GET    /api/v1/portfolios/:id/snapshots

GET    /api/v1/portfolios/:id/holdings
GET    /api/v1/holdings/:id

GET    /api/v1/transactions
POST   /api/v1/transactions
DELETE /api/v1/transactions/:id

GET    /api/v1/assets
GET    /api/v1/assets/search?q=
POST   /api/v1/assets

GET    /api/v1/analytics/summary
GET    /api/v1/analytics/rankings
GET    /api/v1/analytics/allocation

GET    /api/v1/market-data/quote/:assetId
POST   /api/v1/market-data/refresh/:assetId
POST   /api/v1/market-data/refresh-all

GET    /api/v1/broker-accounts
POST   /api/v1/broker-accounts
DELETE /api/v1/broker-accounts/:id
POST   /api/v1/broker-accounts/:id/sync
GET    /api/v1/broker-accounts/:id/sync-jobs

POST   /api/v1/import/csv/preview
POST   /api/v1/import/csv/execute
```

## Key Features

- **FIFO cost-basis accounting** – accurate average buy price and realized/unrealized P&L
- **Multi-asset support** – stocks, crypto, ETFs, commodities, bonds, forex
- **Multi-currency** – USD, EUR, ILS, GBP with conversion
- **Market data abstraction** – pluggable provider system (CoinGecko + Mock included)
- **Broker integration architecture** – ExchangeConnector interface with Binance + Mock implementations
- **CSV import** – preview → validate → commit flow
- **JWT + Refresh Token** rotation with audit logging
- **AES-256-GCM** encryption for API keys at rest

## Adding a New Market Data Provider

1. Create `apps/api/src/modules/market-data/providers/your-provider.ts`
2. Implement the `MarketDataProvider` interface
3. Register in `MarketDataModule`
4. Enable in `MarketDataService.providers[]`

## Adding a New Broker Integration

1. Create `apps/api/src/modules/broker-accounts/connectors/your-broker.connector.ts`
2. Implement the `ExchangeConnector` interface
3. Register in `BrokerAccountsModule`
4. Add to the connector map in `BrokerAccountsService.getConnector()`

## Environment Variables

See `.env.example` for the full list with descriptions.

**Required to change before production:**
- `JWT_ACCESS_SECRET` – min 32 random chars
- `JWT_REFRESH_SECRET` – min 32 random chars
- `ENCRYPTION_KEY` – exactly 32 chars (for AES-256)
- `DATABASE_URL` – your PostgreSQL connection string

## P&L Calculation Logic

The system uses **FIFO** (First In, First Out) cost basis accounting:

```
Average Buy Price = Total Cost of Remaining Lots ÷ Quantity Held
Unrealized P&L   = (Current Price - Avg Buy Price) × Quantity
Realized P&L     = Σ [(Sell Price - FIFO Cost Basis) × Qty Sold] - Fees
Total Return %   = (Unrealized P&L + Realized P&L) ÷ Total Cost × 100
```

See `apps/api/src/modules/holdings/holdings-calculator.service.ts` for full implementation.
