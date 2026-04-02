# OPSphere CRM — Backend

Express 5 + TypeScript REST API for the OPSphere CRM platform. Handles auth, multi-tenant data isolation, AI-powered prospect discovery/enrichment, and outreach automation.

**GitHub:** https://github.com/detronautomation/Opsphere-CRM

## Stack

- **Runtime:** Node.js 20+
- **Framework:** Express 5
- **Language:** TypeScript 5 (compiled via `tsc`, dev via `tsx watch`)
- **Database:** PostgreSQL 15+ via `pg`
- **Validation:** Zod
- **Auth:** JWT (15 min access + 7 day refresh in httpOnly cookie)
- **AI:** Anthropic Claude API (`claude-sonnet-4-20250514`)

## Project Structure

```
src/
├── app.ts                          # Express app setup + route mounts
├── index.ts                        # Server entry point (port 3003)
├── types/index.ts                  # Shared TypeScript interfaces
├── db/
│   ├── pool.ts                     # pg Pool singleton
│   └── migrations/
│       ├── 001_crm_schema.sql      # Core schema — run first
│       ├── 003_add_crm_leads.sql   # crm_leads table
│       └── 004_multi_source.sql    # Extended source types + default campaigns
├── middleware/
│   ├── auth.ts                     # JWT authenticate middleware
│   ├── entityScope.ts              # Extracts entityId from JWT
│   └── errorHandler.ts             # AppError + global error handler
├── routes/
│   ├── auth.ts                     # POST /api/auth/register|login|refresh|logout
│   ├── entities.ts                 # GET|PATCH /api/entities/:id
│   ├── campaigns.ts                # CRUD + /run + /pause
│   ├── prospects.ts                # CRUD + /enrich + /generate-message + /bulk-import
│   ├── leads.ts                    # CRUD (crm_leads) + /stage + /convert
│   ├── messages.ts                 # GET + approve/reject/send
│   ├── pipeline.ts                 # GET events + stats
│   ├── brand-voices.ts             # CRUD + set-default
│   └── appointments.ts             # CRUD + status actions
└── services/agents/
    ├── discoveryAgent.ts           # Multi-source: Serper + Apollo + Bing
    ├── researchAgent.ts            # Multi-source: Proxycurl + Hunter + Clearbit + web scrape
    └── messageAgent.ts             # Anthropic Claude message generation
```

## Setup

```bash
cp .env.example .env    # fill in API keys
npm install
```

### Run Migrations

```bash
npm run migrate          # 001 core schema
npm run migrate:003      # crm_leads table
npm run migrate:004      # extended source types + default campaigns for Detron/Manabuilt/BYRZ
```

### Development

```bash
npm run dev     # tsx watch — hot reload on save at http://localhost:3003
```

### Production

```bash
npm run build   # tsc → dist/
npm start       # node dist/index.js
```

## API Routes

All routes under `/api/crm/*` require a valid `Authorization: Bearer <token>` header. The `entityId` is extracted from the JWT payload and scoped automatically — users only access their own organisation's data.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create organisation + owner account |
| POST | `/api/auth/login` | Login, returns access token + sets refresh cookie |
| POST | `/api/auth/refresh` | Refresh access token using cookie |
| POST | `/api/auth/logout` | Clear refresh cookie |
| GET/PATCH | `/api/entities/:id` | Get or update organisation profile |
| GET/POST | `/api/crm/campaigns` | List / create campaigns |
| GET/PATCH | `/api/crm/campaigns/:id` | Get campaign detail / update |
| POST | `/api/crm/campaigns/:id/run` | Run multi-source discovery agent |
| POST | `/api/crm/campaigns/:id/pause` | Pause active campaign |
| GET/POST | `/api/crm/prospects` | List / create prospects |
| GET/PATCH | `/api/crm/prospects/:id` | Get prospect detail / update |
| POST | `/api/crm/prospects/:id/enrich` | Run enrichment agent |
| POST | `/api/crm/prospects/:id/generate-message` | Generate AI outreach message |
| POST | `/api/crm/prospects/bulk-import` | CSV file upload |
| GET/POST | `/api/crm/leads` | List / create CRM leads |
| PATCH | `/api/crm/leads/:id` | Update lead |
| POST | `/api/crm/leads/:id/stage` | Move lead to a pipeline stage |
| POST | `/api/crm/leads/:id/convert` | Convert lead → prospect |
| GET | `/api/crm/messages` | List outreach messages |
| GET | `/api/crm/messages/review-queue` | Messages in draft status (approval queue) |
| PATCH | `/api/crm/messages/:id` | Edit message body / subject (draft only) |
| POST | `/api/crm/messages/:id/approve` | Approve message for sending |
| POST | `/api/crm/messages/:id/reject` | Reject message with reason |
| POST | `/api/crm/messages/:id/send` | Send via PhantomBuster |
| GET/POST | `/api/crm/brand-voices` | List / create brand voices |
| PATCH/DELETE | `/api/crm/brand-voices/:id` | Update / delete brand voice |
| POST | `/api/crm/brand-voices/:id/set-default` | Set as default brand voice |
| GET/POST | `/api/crm/appointments` | List / create appointments |
| PATCH | `/api/crm/appointments/:id` | Update appointment status |
| GET | `/api/crm/pipeline/events` | Pipeline event feed (filterable, paginated) |
| GET | `/api/crm/pipeline/stats` | Funnel stage breakdown + campaign performance metrics |
| GET | `/api/health` | Health check |

## Discovery Agent — Multi-Source

`src/services/agents/discoveryAgent.ts`

Runs all configured sources **concurrently** with `Promise.allSettled`, then deduplicates by `linkedin_url` (primary) and `full_name + company_name` (secondary):

| Source | Env Key | Notes |
|--------|---------|-------|
| **Serper** | `SERPER_API_KEY` | Google LinkedIn SERP — returns stub data when key absent |
| **Apollo.io** | `APOLLO_API_KEY` | B2B people database — skipped when key absent |
| **Bing Search** | `BING_SEARCH_KEY` | LinkedIn SERP via Bing — skipped when key absent |

## Enrichment Agent — Multi-Source

`src/services/agents/researchAgent.ts`

Runs sources concurrently, merges the best data from each, and saves any found email back to `prospects.email` via `COALESCE` (never overwrites an existing email):

| Source | Env Key | Notes |
|--------|---------|-------|
| **Proxycurl** | `PROXYCURL_API_KEY` | LinkedIn profile + company data — stub when key absent |
| **Hunter.io** | `HUNTER_API_KEY` | Email finder (only saves if confidence ≥ 50) |
| **Clearbit** | `CLEARBIT_API_KEY` | Company description + employee range |
| **Web scrape** | *(none)* | Fetches `<meta description>` / `og:description` from company website |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `JWT_SECRET` | **Yes** | Access token signing secret |
| `JWT_REFRESH_SECRET` | **Yes** | Refresh token signing secret |
| `PORT` | No | Server port (default `3003`) |
| `CORS_ORIGIN` | No | Frontend URL (default `http://localhost:3000`) |
| `ANTHROPIC_API_KEY` | No | Claude AI message generation |
| `SERPER_API_KEY` | No | Serper.dev Google SERP discovery |
| `APOLLO_API_KEY` | No | Apollo.io people search |
| `BING_SEARCH_KEY` | No | Bing Web Search API |
| `PROXYCURL_API_KEY` | No | LinkedIn enrichment via Proxycurl |
| `HUNTER_API_KEY` | No | Hunter.io email finder |
| `CLEARBIT_API_KEY` | No | Clearbit company enrichment |
| `PHANTOMBUSTER_API_KEY` | No | PhantomBuster LinkedIn automation |
| `NODE_ENV` | No | `development` or `production` |

## Error Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```
