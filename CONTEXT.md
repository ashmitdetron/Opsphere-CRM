# OPSphere CRM — LLM Context Document

> Use this file to understand the full state of the project before making changes.
> Last updated: 2026-04-10

---

## What This Is

OPSphere CRM is a **multi-tenant outbound sales automation platform**. Organisations sign up, create outbound campaigns with ICP (Ideal Customer Profile) targeting, and the platform discovers prospects, enriches their profiles with AI, generates personalised outreach messages, and tracks the full pipeline from contact to meeting booked.

It is also the **first app built on the OPSphere foundation** — a reusable SaaS boilerplate being developed in parallel (see `OPS-001` through `OPS-030` in the plan file).

---

## Repo Structure

```
Opsphere-CRM/
├── OPSphere-CRM-Backend/     # Express + TypeScript API
│   ├── src/
│   │   ├── app.ts            # Express app setup, middleware, route mounting
│   │   ├── index.ts          # Entry point, starts HTTP server on PORT
│   │   ├── config/           # (planned) env validation
│   │   ├── db/
│   │   │   ├── pool.ts       # pg Pool, SSL for Supabase, max 10 connections
│   │   │   └── migrations/   # Raw SQL migration files (001–004)
│   │   ├── middleware/
│   │   │   ├── auth.ts       # JWT Bearer token verification → req.user
│   │   │   ├── entityScope.ts # X-Entity-Id header validation + membership check
│   │   │   └── errorHandler.ts # AppError class + global error handler
│   │   ├── routes/           # One file per resource (see API Reference below)
│   │   ├── services/
│   │   │   ├── agents/
│   │   │   │   ├── discoveryAgent.ts  # Finds prospects via Serper/Bing/Apollo
│   │   │   │   ├── researchAgent.ts   # Enriches prospects via Proxycurl/Hunter/Clearbit
│   │   │   │   └── messageAgent.ts    # Generates outreach via Claude (Anthropic)
│   │   │   └── sendQueue.ts  # Sends messages via PhantomBuster (sync, not a real queue)
│   │   └── types/index.ts    # All shared TypeScript interfaces
│   ├── .env                  # Local secrets (never committed)
│   ├── .env.example          # Template
│   ├── package.json
│   └── tsconfig.json
│
├── opsphere-crm-ui/          # Next.js 16 + Tailwind 4 frontend
│   └── src/
│       ├── app/
│       │   ├── (auth)/       # /login, /register (public)
│       │   └── (dashboard)/  # All protected pages
│       ├── components/       # sidebar, page-header, badge, stat-card, empty-state
│       └── lib/
│           ├── api.ts        # Fetch wrapper with auth headers + token refresh
│           ├── auth-context.tsx # AuthProvider: login, register, logout, /me
│           └── types.ts      # Frontend-facing type definitions
│
├── render.yaml               # Render deployment config for backend
├── .github/workflows/ci.yml  # TypeScript typecheck + ESLint on push
└── CONTEXT.md                # This file
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend runtime | Node.js ≥20, TypeScript (CommonJS, ES2022) |
| HTTP framework | Express 5 |
| Database | PostgreSQL via Supabase (pooler URL, SSL) |
| DB client | `pg` (node-postgres) with connection pool |
| Auth | JWT (jsonwebtoken) — access 15m, refresh 7d |
| Password hashing | bcrypt (12 rounds) |
| Validation | zod |
| AI | Anthropic Claude (message generation) |
| Frontend | Next.js 16, React 19, Tailwind 4 |
| Deployment | Backend → Render (free), Frontend → Vercel |
| Database hosting | Supabase (free tier, pooler connection for IPv4) |

---

## Database Schema

All tables use UUID primary keys and `updated_at` triggers. All CRM tables have `entity_id` for org isolation.

### Core Tables

**`organisations`** — one row per org/tenant
- `id`, `name`, `industry`, `website`, `created_at`, `updated_at`

**`crm_users`** — platform users
- `id`, `entity_id` (FK → organisations), `email` (unique), `password_hash`
- `display_name`, `role` ENUM(`owner`, `admin`, `member`)
- `token_version` INT — incremented to invalidate all refresh tokens

**`crm_entity_members`** — many-to-many user ↔ org (supports workspace switching)
- `id`, `entity_id`, `user_id`, `role`, `created_at`

**`brand_voices`** — AI messaging persona per org
- `id`, `entity_id`, `name`, `industry`, `value_proposition`, `tone`
- `avoid_phrases` TEXT[], `example_messages` TEXT[], `is_default` BOOL

**`campaigns`** — outbound campaign with ICP config
- `id`, `entity_id`, `name`, `description`, `status` ENUM(`draft`,`active`,`paused`,`completed`,`archived`)
- `brand_voice_id`, `icp_industries[]`, `icp_seniority[]`, `icp_company_size`, `icp_locations[]`, `icp_keywords[]`
- `daily_send_limit`, `total_prospect_count`, `total_message_count`, `total_reply_count`, `total_meeting_count`
- `created_by` (user_id)

**`prospects`** — one person being targeted in a campaign
- `id`, `entity_id`, `campaign_id`
- `first_name`, `last_name`, `full_name`, `email`, `linkedin_url`
- `company_name`, `company_website`, `job_title`, `industry`, `location`, `company_size`
- `source` ENUM(`csv`, `serper`, `proxycurl`, `linkedin`, `manual`, `apollo`, `bing`), `source_tier`
- `enrichment_status` ENUM(`pending`, `in_progress`, `completed`, `failed`, `skipped`)
- `enrichment_data` JSONB
- `pipeline_stage` ENUM(`found`, `researched`, `message_drafted`, `message_approved`, `message_sent`, `replied`, `meeting_booked`, `converted`, `rejected`)
- `is_approved` BOOL, `rejection_reason`

**`outreach_messages`** — AI-generated message per prospect
- `id`, `entity_id`, `campaign_id`, `prospect_id`
- `subject`, `body`, `channel` ENUM(`linkedin`, `email`)
- `status` ENUM(`draft`, `approved`, `rejected`, `queued`, `sent`, `failed`)
- `approved_by`, `approved_at`, `rejection_reason`, `sent_at`
- `phantombuster_ref`, `ai_model`, `ai_prompt_version`

**`pipeline_events`** — append-only audit of stage transitions
- `id`, `entity_id`, `prospect_id`, `campaign_id`
- `event_type`, `from_stage`, `to_stage`, `notes`, `created_by`, `created_at`

**`appointments`** — meetings booked with prospects
- `id`, `entity_id`, `prospect_id`, `campaign_id`
- `title`, `scheduled_at`, `duration_minutes`, `location`, `notes`
- `status` ENUM(`scheduled`, `completed`, `cancelled`, `no_show`)
- `created_by`

**`crm_leads`** — lightweight inbound/manual lead tracker
- `id`, `entity_id`, `name`, `email`, `phone`, `company`, `source`
- `stage_id`, `assigned_to`, `notes`, `value`, `metadata` JSONB

---

## Auth Flow

```
POST /api/auth/register  → creates org + user + entity_member, returns { accessToken, refreshToken, user, entity }
POST /api/auth/login     → validates credentials, returns same shape
POST /api/auth/refresh   → validates refresh token, returns new token pair
POST /api/auth/logout    → clears refreshToken cookie
GET  /api/auth/me        → returns current user + org (requires Bearer token)
```

**JWT access token payload:** `{ sub: userId, entityId, role, tv: tokenVersion }`

**Every protected route requires:**
1. `Authorization: Bearer <accessToken>` — verified by `authenticate` middleware
2. `X-Entity-Id: <orgId>` — verified by `entityScope` middleware (checks JWT matches header AND user is a member)

**Frontend (`lib/api.ts`)** — handles all of this automatically:
- Injects `Authorization` and `X-Entity-Id` headers on every request
- On 401, attempts token refresh via `/api/auth/refresh`, retries once
- On refresh failure, clears localStorage and redirects to `/login`

---

## API Reference

All protected routes require `authenticate` + `entityScope` (except `/api/auth/*` and `/api/entities`).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (public) |
| POST | `/api/auth/register` | Create org + user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh tokens |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Current user + org |
| GET | `/api/entities` | List user's orgs |
| PATCH | `/api/entities/:id` | Update org (owner/admin) |
| DELETE | `/api/entities/:id` | Delete org (owner only) |
| GET | `/api/crm/leads` | List leads (search, filter, paginate) |
| GET | `/api/crm/leads/:id` | Get lead |
| POST | `/api/crm/leads` | Create lead |
| PATCH | `/api/crm/leads/:id` | Update lead |
| POST | `/api/crm/leads/:id/stage` | Move lead to stage |
| POST | `/api/crm/leads/:id/convert` | Convert lead → prospect |
| GET | `/api/crm/campaigns` | List campaigns |
| GET | `/api/crm/campaigns/:id` | Get campaign + stage breakdown |
| POST | `/api/crm/campaigns` | Create campaign |
| PATCH | `/api/crm/campaigns/:id` | Update campaign |
| POST | `/api/crm/campaigns/:id/run` | Run discovery agent |
| POST | `/api/crm/campaigns/:id/pause` | Pause campaign |
| GET | `/api/crm/prospects` | List prospects (filter by campaign, stage, search) |
| GET | `/api/crm/prospects/:id` | Get prospect + messages + events |
| POST | `/api/crm/prospects` | Create prospect manually |
| PATCH | `/api/crm/prospects/:id` | Update prospect |
| POST | `/api/crm/prospects/:id/enrich` | Run AI enrichment |
| POST | `/api/crm/prospects/:id/generate-message` | Generate AI outreach message |
| POST | `/api/crm/prospects/bulk-import` | CSV upload → bulk import |
| GET | `/api/crm/messages` | List outreach messages |
| GET | `/api/crm/pipeline/stats` | Pipeline funnel stats |
| GET | `/api/crm/pipeline/events` | Pipeline event log |
| GET | `/api/crm/brand-voices` | List brand voices |
| GET | `/api/crm/brand-voices/:id` | Get brand voice |
| POST | `/api/crm/brand-voices` | Create brand voice |
| PATCH | `/api/crm/brand-voices/:id` | Update brand voice |
| DELETE | `/api/crm/brand-voices/:id` | Delete brand voice |
| GET | `/api/crm/appointments` | List appointments |
| GET | `/api/crm/appointments/:id` | Get appointment |
| POST | `/api/crm/appointments` | Book appointment (auto-advances prospect stage) |
| PATCH | `/api/crm/appointments/:id` | Update appointment |
| DELETE | `/api/crm/appointments/:id` | Delete appointment |

---

## AI Agents

All three agents are synchronous — they block the HTTP request. No queue system exists yet (OPS-018).

### Discovery Agent (`discoveryAgent.ts`)
**Trigger:** `POST /api/crm/campaigns/:id/run`
**Input:** Campaign object (ICP fields: industries, seniority, locations, keywords)
**What it does:** Calls Serper (Google SERP) and/or Bing to find LinkedIn profile URLs matching the ICP. Falls back to Apollo if configured.
**Output:** `DiscoveryResult[]` — `{ linkedin_url, full_name, company_name, job_title, email?, source }`
**Deduplication:** Skips prospects where `linkedin_url` already exists in the campaign.

### Research Agent (`researchAgent.ts`)
**Trigger:** `POST /api/crm/prospects/:id/enrich`
**Input:** Prospect record
**What it does:** Calls Proxycurl (LinkedIn enrichment), Hunter (email finder), Clearbit (company data). Sets `enrichment_status` to `in_progress` → `completed`/`failed`.
**Output:** `EnrichmentResult` — `{ company_size, recent_news, about_section, headline, summary, email, raw }`
**Side effects:** Updates prospect `pipeline_stage` to `researched`, inserts pipeline event.

### Message Agent (`messageAgent.ts`)
**Trigger:** `POST /api/crm/prospects/:id/generate-message`
**Input:** Prospect + Campaign + BrandVoice (optional)
**What it does:** Calls Claude (Anthropic API) with a prompt that combines prospect enrichment data, campaign ICP, and brand voice tone/examples.
**Output:** `GeneratedMessage` — `{ subject, body, ai_model, ai_prompt_version }`
**Side effects:** Inserts `outreach_messages` row, advances prospect to `message_drafted`, increments `campaign.total_message_count`.

---

## Frontend Pages

All dashboard pages are under `(dashboard)` route group — require auth (redirects to `/login` if no `accessToken` in localStorage).

| Route | Page | Key functionality |
|-------|------|------------------|
| `/login` | Login | Email/password login |
| `/register` | Register | Create org + account |
| `/dashboard` | Dashboard | Stat cards: leads, prospects, messages, meetings. Empty state CTAs. |
| `/leads` | Leads | Table with search, edit inline, stage move, pagination |
| `/campaigns` | Campaigns | List with status badge, link to detail |
| `/campaigns/new` | New Campaign | Form: name, description, ICP fields, brand voice, daily limit |
| `/campaigns/:id` | Campaign Detail | Stage breakdown, prospect list, run/pause controls |
| `/prospects` | Prospects | Table with search + filters |
| `/prospects/kanban` | Kanban | Pipeline board by stage |
| `/prospects/import` | CSV Import | Upload CSV → assign to campaign |
| `/prospects/:id` | Prospect Detail | Full profile, enrich, generate message, event log |
| `/messages` | Messages | All outreach messages across campaigns |
| `/pipeline` | Pipeline | Funnel stats, campaign-level metrics |
| `/brand-voices` | Brand Voices | List, create, edit, delete |
| `/appointments` | Appointments | List with prospect + campaign context |
| `/appointments/new` | New Appointment | Form: prospect, campaign, datetime, duration |
| `/settings` | Settings | Org details (editable), account info, integrations list |

---

## Environment Variables

### Required (backend fails without these)
```
DATABASE_URL        # Supabase pooler URL — must URL-encode special chars in password
JWT_SECRET          # Strong random string for access tokens
JWT_REFRESH_SECRET  # Different strong random string for refresh tokens
```

### Optional (features degrade gracefully)
```
ANTHROPIC_API_KEY   # Claude — message generation
SERPER_API_KEY      # Google SERP — prospect discovery
APOLLO_API_KEY      # Apollo.io — B2B database discovery
BING_SEARCH_KEY     # Bing — LinkedIn SERP fallback
PROXYCURL_API_KEY   # LinkedIn enrichment
HUNTER_API_KEY      # Email finder
CLEARBIT_API_KEY    # Company enrichment
PHANTOMBUSTER_API_KEY # LinkedIn message sending
```

### Frontend (must be set in Vercel)
```
NEXT_PUBLIC_API_URL # Backend URL — NO trailing slash. e.g. https://opsphere-crm-backend-1uv6.onrender.com
```

### Known gotchas
- `DATABASE_URL` password must be URL-encoded (`!` → `%21`, `@` → `%40`, `#` → `%23`)
- Supabase free tier pauses after 7 days inactivity — must use **pooler URL** (not direct) on Render (IPv4 only)
- `CORS_ORIGIN` on Render must match Vercel URL **exactly, no trailing slash**
- `NEXT_PUBLIC_API_URL` in Vercel must have **no trailing slash** — double-slash in URLs causes 404s
- Vercel env var changes require a **manual redeploy** to take effect

---

## Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Backend | Render (free) | `https://opsphere-crm-backend-1uv6.onrender.com` |
| Frontend | Vercel (free) | `https://opsphere-crm-delta.vercel.app` |
| Database | Supabase (free) | Project: `msyfroytxwvenmcatnls` |
| Git | GitHub (private) | `ashmitdetron/Opsphere-CRM` |

**Render free tier:** Spins down after 15min idle. First request after sleep takes ~30s cold start.

**Build commands:**
- Backend: `npm install --include=dev && npm run build` → `npm start`
- Frontend: Vercel auto-detects Next.js, root dir set to `opsphere-crm-ui`

---

## What's Missing / Planned

See `OPS-001` through `OPS-030` in `/Users/ashmit/.claude/plans/stateless-imagining-dawn.md`.

Quick summary of critical gaps:

| Gap | Ticket |
|-----|--------|
| Env validation at startup | OPS-001 |
| Structured logging (Pino) | OPS-002 |
| Error tracking (Sentry) | OPS-003 |
| RBAC route enforcement | OPS-004 |
| Email service (Resend) | OPS-005 |
| Password reset flow | OPS-006 |
| Google OAuth | OPS-009 |
| Microsoft SSO | OPS-010 |
| Workspace switcher UI | OPS-011 |
| Team invites | OPS-012 |
| Onboarding wizard | OPS-013 |
| Stripe billing | OPS-015 |
| Background job queue (BullMQ) | OPS-018 |
| File storage (Cloudflare R2) | OPS-019 |
| User API keys + webhooks | OPS-020, OPS-021 |
| Full audit log | OPS-022 |
| Tests (zero coverage currently) | OPS-026 |

---

## Conventions

### Backend patterns
- Every route file exports a single `Router`
- All DB queries use parameterised statements (`$1`, `$2`) — no string interpolation
- Errors thrown as `new AppError(statusCode, 'ERROR_CODE', 'message')` — caught by global error handler
- Validation via `zod` schemas at route entry, returns `{ error: { code: 'VALIDATION_ERROR', details: [] } }`
- All writes are scoped to `authed.entityId` — never trust client-supplied entity unless verified by `entityScope`
- Transactions used for multi-table writes (register, lead convert, bulk import, appointments)

### Frontend patterns
- All API calls go through `lib/api.ts` — never use `fetch` directly in components
- Auth state lives in `AuthContext` — access via `useAuth()`
- `accessToken` and `entityId` stored in `localStorage`
- `refreshToken` stored in httpOnly cookie (sent automatically via `credentials: 'include'`)
- Pages are client components (`'use client'`) — no server-side data fetching yet

### Error codes (backend)
```
UNAUTHORIZED          401  Missing/malformed Authorization header
TOKEN_EXPIRED         401  Access token expired (frontend should refresh)
INVALID_TOKEN         401  Malformed token
MISSING_ENTITY        400  X-Entity-Id header absent
INVALID_ENTITY        400  X-Entity-Id not a valid UUID
ENTITY_MISMATCH       403  Header entity ≠ token entity
NOT_MEMBER            403  User not in this org
VALIDATION_ERROR      400  Zod schema failure (includes details[])
EMAIL_EXISTS          409  Registration with duplicate email
INVALID_CREDENTIALS   401  Login with wrong email/password
NOT_FOUND             404  Resource not found or not owned by entity
INTERNAL_ERROR        500  Unhandled exception (message hidden in production)
```
