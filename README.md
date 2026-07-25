# ──────────────────────────────────────────────
# Price Intelligence Platform
# ──────────────────────────────────────────────

## Architecture

```
price-intelligence/
├── frontend/          # React SPA (Vite + Tailwind + React Router)
│   ├── src/
│   │   ├── api/       # apiClient.js (Axios + silent token refresh)
│   │   ├── context/   # AuthContext.jsx
│   │   ├── pages/     # LoginPage, DashboardPage, ProductsPage
│   │   └── components/# Layout.jsx (sidebar shell)
│   └── ...
│
└── backend/           # Node.js + Express API
    ├── prisma/
    │   └── schema.prisma   # DB schema (Prisma v5)
    └── src/
        ├── server.js        # Express entry point
        ├── config/
        │   ├── database.js  # Prisma singleton
        │   └── pgboss.js    # pg-boss queue config
        ├── api/
        │   ├── controllers/ # authController, productController, priceController
        │   ├── routes/      # auth, product, price routes
        │   └── middleware/  # authenticate (JWT), errorHandler
        ├── queue/
        │   └── jobQueue.js  # enqueueScrapingJob()
        └── workers/
            └── scraperWorker.js  # Puppeteer price scraper
```

## Quick Start

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Fill in your DATABASE_URL (Neon / any cloud Postgres)
# Generate JWT secrets: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

npm run prisma:push      # Push schema to your database
npm run prisma:generate  # Generate Prisma client
npm run dev              # Start with nodemon (port 4000)
```

### 2. Frontend Setup

```bash
cd frontend
# Create .env.local
echo "VITE_API_URL=http://localhost:4000/api" > .env.local

npm run dev              # Start Vite dev server (port 5173)
```

## Key Design Decisions

### JWT Security (Token Rotation)
- **Access token** (15 min): Returned in JSON response body, stored **in-memory** (React ref) — never localStorage
- **Refresh token** (7 days): Sent as an **HTTP-only, Secure, SameSite=Strict cookie** — inaccessible to JavaScript
- On every `/auth/refresh` call, the old refresh token is **revoked** and a new one is issued (rotation = no replay attacks)
- Frontend `apiClient.js` intercepts `401 TOKEN_EXPIRED` responses and silently refreshes without UX interruption

### Scraper Resilience
- ALL `page.evaluate()` / `page.$eval()` calls are wrapped in `try/catch`
- `browser.close()` is in a `finally` block — runs even if the page throws
- Failed jobs are **re-thrown** so pg-boss marks them as `failed` and auto-retries with exponential backoff
- Structured error logging (never crashes the Node process)

### Database Schema
- `MerchantListing` is the bridge: maps an abstract `Product` → a concrete store URL
- `Price` is **append-only** — prices are always INSERTed, never UPDATEd, preserving full history
- `RefreshToken` table enables server-side session invalidation (logout, security events)

### Error Handling
- Centralized `errorHandler` middleware is the **only** place that touches `err`
- Prisma error codes (P2002, P2025) are mapped to human-readable HTTP responses
- Stack traces are stripped in production (`NODE_ENV=production`)

## Environment Variables

See `backend/.env.example` for the full list. Minimum required:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon, Supabase, etc.) |
| `JWT_ACCESS_SECRET` | 64+ byte random secret for access tokens |
| `JWT_REFRESH_SECRET` | 64+ byte random secret for refresh tokens |
| `FRONTEND_URL` | React dev server URL for CORS (default: `http://localhost:5173`) |

## API Endpoints

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | None | Create account |
| POST | `/api/auth/login` | None | Login → access token + HTTP-only cookie |
| POST | `/api/auth/refresh` | Cookie | Rotate tokens silently |
| POST | `/api/auth/logout` | Cookie | Revoke refresh token |
| GET  | `/api/auth/me` | Bearer | Get current user |

### Products
| Method | Path | Auth | Description |
|---|---|---|---|
| GET    | `/api/products` | Bearer | Paginated product list |
| POST   | `/api/products` | ADMIN | Create product |
| GET    | `/api/products/:id` | Bearer | Product + listings |
| PATCH  | `/api/products/:id` | ADMIN | Update product |
| DELETE | `/api/products/:id` | ADMIN | Delete product |
| POST   | `/api/products/:id/listings` | ADMIN | Add merchant listing |
| POST   | `/api/products/listings/:listingId/scrape` | Bearer | Trigger scrape job |

### Prices
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/listings/:listingId/prices` | Bearer | Paginated price history |
| GET | `/api/listings/:listingId/prices/latest` | Bearer | Most recent price |
| GET | `/api/products/:productId/price-comparison` | Bearer | Cross-store comparison |
