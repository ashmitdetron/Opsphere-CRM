# OPSphere CRM Backend — Codebase Explained

## What Does This App Do?

This is the **backend server for OPSphere CRM** — an AI-powered outbound sales automation platform.

In plain English: it helps sales teams find potential customers (prospects), research them automatically, write personalised LinkedIn messages using AI, get a human to review and approve those messages, then send them via LinkedIn automation — all tracked in a pipeline.

The full flow looks like this:

```
Create Campaign → Discover Prospects → Research/Enrich → AI Drafts Message → Human Approves → Send via LinkedIn
```

---

## Tech Stack (Quick Summary)

| What | How |
|---|---|
| Language | TypeScript |
| Framework | Express.js (v5) |
| Database | PostgreSQL (via `pg` pool) |
| Auth | JWT (access + refresh tokens), bcrypt for passwords |
| AI | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| Prospect Discovery | Serper (Google), Apollo.io, Bing Search |
| Profile Enrichment | Proxycurl (LinkedIn), Hunter.io (email), Clearbit (company) |
| Message Sending | PhantomBuster (LinkedIn automation) |
| Validation | Zod |

---

## File-by-File Breakdown

### Entry Points

#### `src/index.ts`
The starting point of the server. Reads the `PORT` from environment variables (defaults to 3003), then starts the Express app. That's it — one file, four lines of logic.

#### `src/app.ts`
Wires everything together. Sets up:
- **CORS** — allows the frontend (default: `localhost:3000`) to talk to this server
- **JSON body parsing** — up to 10MB (for CSV uploads)
- **Cookie parsing** — for refresh token cookies
- All routes mounted at their paths (public: `/api/auth`, protected: everything under `/api/crm/...`)
- Error handler at the very end

---

### Database

#### `src/db/pool.ts`
Creates a shared PostgreSQL connection pool (max 20 connections). All route files import this and use it to run SQL queries. Never creates a new connection per request — reuses pooled connections efficiently.

#### `src/db/migrations/001_crm_schema.sql`
The **main database schema**. Creates all the tables:
- `organisations` — companies/clients using the CRM
- `crm_users` — user accounts (owner/admin/member roles)
- `crm_entity_members` — which users belong to which organisation
- `brand_voices` — writing style configs for AI messages
- `campaigns` — outreach campaigns with ICP (ideal customer profile) filters
- `prospects` — individual people being targeted in a campaign
- `outreach_messages` — AI-generated messages for each prospect
- `pipeline_events` — audit log of every stage change (append-only)
- `appointments` — meetings booked with prospects

Also adds a PostgreSQL trigger on every table to auto-update the `updated_at` timestamp on every row change.

#### `src/db/migrations/002_add_leads.sql` / `003_add_crm_leads.sql`
Adds a `crm_leads` table — a simpler "inbound lead" concept (name, email, company, stage) separate from the outbound prospect pipeline. Leads can be manually converted into prospects to enter the outbound flow.

#### `src/db/migrations/004_multi_source.sql`
Two things:
1. Extends the allowed `source` values on the `prospects` table to include `apollo` and `bing` (previously only had serper, proxycurl, linkedin, manual, csv).
2. Seeds pre-built draft campaigns for three known organisations: **Detron**, **Manabuilt**, and **BYRZ** — each with target industries, seniority levels, and keywords already filled in.

---

### Types

#### `src/types/index.ts`
All shared TypeScript types in one place. Defines:
- Database row shapes (`Organisation`, `CrmUser`, `Campaign`, `Prospect`, `OutreachMessage`, `PipelineEvent`, `Appointment`, `BrandVoice`)
- JWT payload shapes (`JwtAccessPayload`, `JwtRefreshPayload`)
- `AuthenticatedRequest` — extends Express's `Request` to carry the logged-in user's info
- Agent result types (`DiscoveryResult`, `EnrichmentResult`, `GeneratedMessage`, `SendQueueResult`)

---

### Middleware

#### `src/middleware/auth.ts`
Checks every protected request for a valid JWT `Bearer` token in the `Authorization` header. If the token is missing, expired, or invalid, it returns a 401 error. If valid, it attaches the user's ID, entity ID (organisation), and role to the request object so route handlers can use them.

#### `src/middleware/entityScope.ts`
A second layer of protection for all `/api/crm/...` routes. Requires an `X-Entity-Id` header (the UUID of the organisation you're acting on behalf of). Checks three things:
1. The header is a valid UUID
2. It matches the entity in the JWT token
3. The user is actually a member of that organisation in the database

This prevents users from accessing another organisation's data even if they somehow have a valid token.

#### `src/middleware/errorHandler.ts`
Catches all errors thrown anywhere in the app. If it's an `AppError` (a custom error class defined here with a status code and error code), it returns a structured JSON error. Otherwise it logs the error and returns a generic 500. In production, it hides the raw error message from the response.

---

### Routes

#### `src/routes/auth.ts`
Handles user authentication. Four endpoints:
- **POST `/register`** — creates a new user AND a new organisation in one transaction. Returns access + refresh tokens.
- **POST `/login`** — verifies email/password, returns tokens.
- **POST `/refresh`** — swaps a valid refresh token for new access + refresh tokens. Uses a `token_version` field to allow token revocation.
- **POST `/logout`** — clears the refresh token cookie.
- **GET `/me`** — returns the current user's profile and their organisation.

Access tokens expire in 15 minutes; refresh tokens last 7 days and are stored in an `httpOnly` cookie.

#### `src/routes/entities.ts`
Manages organisations (called "entities" in the API). Logged-in users can:
- **GET `/`** — list all organisations they belong to
- **GET `/:id`** — get a single organisation (must be a member)
- **POST `/`** — create a new additional organisation
- **PATCH `/:id`** — update org name/industry/website (owners and admins only)

#### `src/routes/leads.ts`
Manages inbound CRM leads (simpler than prospects). Supports:
- List, get, create, update leads with filters (stage, assigned user, search)
- **POST `/:id/stage`** — move a lead to a different pipeline stage
- **POST `/:id/convert`** — converts a lead into a prospect in a specific campaign (bridges inbound and outbound)

#### `src/routes/campaigns.ts`
Manages outreach campaigns. Supports CRUD operations plus:
- **POST `/:id/run`** — triggers the Discovery Agent to find new prospects matching the campaign's ICP filters, then saves them to the database (deduplicating by LinkedIn URL)
- **POST `/:id/pause`** — pauses an active campaign

Campaign stats (prospect count, message count, reply count, meeting count) are tracked as counters on the campaign row.

#### `src/routes/prospects.ts`
The most feature-rich route file. Manages individual prospects within campaigns:
- List/get/create/update prospects with filters (campaign, pipeline stage, enrichment status, search)
- **POST `/:id/enrich`** — calls the Research Agent to look up the prospect's LinkedIn profile, find their email, and get company data
- **POST `/:id/generate-message`** — calls the Message Agent to write a personalised LinkedIn message using Claude AI
- **POST `/bulk-import`** — accepts a CSV file upload and imports prospects in bulk (handles quoted fields, maps flexible column names)

#### `src/routes/messages.ts`
Manages outreach messages (AI-generated drafts awaiting approval):
- List all messages with filters; get a special **review queue** (draft messages with prospect details joined)
- **PATCH `/:id`** — edit a draft message's subject or body
- **POST `/:id/approve`** — approves a message, advancing the prospect to `message_approved` stage
- **POST `/:id/reject`** — rejects a message with a reason (logs a pipeline event)
- **POST `/:id/send`** — sends an approved message via PhantomBuster; updates status to `sent` or `failed`

#### `src/routes/pipeline.ts`
Read-only analytics on the sales pipeline:
- **GET `/stats`** — returns a breakdown of prospects by stage + per-campaign stats (message rate, reply rate, meeting rate as percentages)
- **GET `/events`** — the full audit log of all pipeline stage transitions, filterable by prospect, campaign, or event type

#### `src/routes/brand-voices.ts`
Manages brand voice configurations — essentially writing style guides for the AI. Each voice defines a tone, value proposition, phrases to avoid, and example messages. Only one can be marked as the default at a time (setting a new default automatically un-defaults the old one). Full CRUD including delete.

#### `src/routes/appointments.ts`
Manages meetings booked with prospects. Creating an appointment automatically:
1. Advances the prospect's pipeline stage to `meeting_booked`
2. Logs a `meeting_booked` pipeline event
3. Increments the campaign's `total_meeting_count`

Supports filtering by status (scheduled/completed/cancelled/no_show) and campaign. Includes joined prospect and campaign names in the response.

---

### Services / Agents

#### `src/services/agents/discoveryAgent.ts`
Finds new prospects matching a campaign's ICP (Ideal Customer Profile). Runs **three sources in parallel**:

1. **Serper** — searches Google for LinkedIn profiles matching the ICP criteria. Parses LinkedIn page titles to extract name, job title, company.
2. **Apollo.io** — queries Apollo's B2B people database with seniority, location, and industry filters. Returns structured data including emails.
3. **Bing Search** — same Google-style LinkedIn SERP search but via Bing's API as a fallback.

After gathering results from all sources, it **deduplicates** by LinkedIn URL and by name+company combination. If no API keys are set, it returns stub data (for local development).

#### `src/services/agents/researchAgent.ts`
Enriches an existing prospect with deeper data. Also runs multiple sources:

1. **Proxycurl** — fetches the prospect's full LinkedIn profile (headline, summary, work history, company info)
2. **Clearbit** — looks up the prospect's company by domain (employee count, description, industry)
3. **Hunter.io** — finds the prospect's professional email address given their name and company domain (only uses results with ≥50% confidence score)
4. **Web scraping fallback** — if no company description is found via APIs, it fetches the company website and extracts the meta description tag

Results from all sources are merged, with Proxycurl data taking priority over Clearbit.

#### `src/services/agents/messageAgent.ts`
Generates personalised LinkedIn connection messages using **Claude (claude-sonnet-4-20250514)**. 

Builds a system prompt from the campaign's brand voice config (tone, value proposition, forbidden phrases, example messages), then builds a user prompt from everything known about the prospect (name, title, company, LinkedIn summary, company description, etc.).

The AI is instructed to keep messages under 300 characters, reference something specific about the prospect, and end with a soft question — not a sales pitch.

Falls back to a template stub if the Anthropic API key isn't set.

#### `src/services/sendQueue.ts`
Sends approved messages via **PhantomBuster** — a LinkedIn automation tool. Takes the prospect's LinkedIn URL and the message body, formats them into a PhantomBuster payload, and calls their API to queue the message for sending.

Returns a `containerId` (the PhantomBuster job reference) stored as `phantombuster_ref` on the message record. If the prospect has no LinkedIn URL, it returns an error immediately. Falls back to a stub response if the API key isn't set.

---

## Data Flow: End-to-End Example

Here's what happens when a user runs a full campaign:

```
1. User creates a Campaign
   → Sets ICP filters: industry=SaaS, seniority=Head of Sales, location=Sydney

2. User hits POST /campaigns/:id/run
   → discoveryAgent runs Serper + Apollo + Bing in parallel
   → Returns 20 deduplicated LinkedIn prospects
   → Each saved to DB as a Prospect with pipeline_stage='found'

3. User hits POST /prospects/:id/enrich (for each prospect)
   → researchAgent calls Proxycurl + Clearbit + Hunter.io
   → Prospect updated: enrichment_status='completed', pipeline_stage='researched'

4. User hits POST /prospects/:id/generate-message
   → messageAgent calls Claude API with brand voice + prospect data
   → OutreachMessage saved with status='draft', pipeline_stage='message_drafted'

5. User reviews the message in the review queue
   → Can edit the subject/body
   → Hits POST /messages/:id/approve
   → Message status='approved', pipeline_stage='message_approved'

6. User hits POST /messages/:id/send
   → sendQueue calls PhantomBuster API
   → Message status='sent', pipeline_stage='message_sent'
   → phantombuster_ref stored for tracking

7. When the prospect replies / books a meeting:
   → User manually updates pipeline stage or creates an Appointment
   → Campaign counters (replies, meetings) updated
```

---

## Multi-Tenancy

Every table has an `entity_id` column (UUID of the organisation). Every database query filters by `entity_id`. The `entityScope` middleware enforces this at the HTTP layer — you can never accidentally read or write another organisation's data.

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Server port (default: 3003) |
| `JWT_SECRET` | Signs access tokens (15 min expiry) |
| `JWT_REFRESH_SECRET` | Signs refresh tokens (7 day expiry) |
| `CORS_ORIGIN` | Frontend URL for CORS |
| `ANTHROPIC_API_KEY` | Claude AI for message generation |
| `SERPER_API_KEY` | Google LinkedIn search |
| `APOLLO_API_KEY` | B2B people database |
| `BING_SEARCH_KEY` | Bing LinkedIn search (fallback) |
| `PROXYCURL_API_KEY` | LinkedIn profile enrichment |
| `HUNTER_API_KEY` | Email finder |
| `CLEARBIT_API_KEY` | Company data enrichment |
| `PHANTOMBUSTER_API_KEY` | LinkedIn message automation |

All third-party keys are optional — the agents fall back to stub/mock data if keys are missing, so local development works without any paid API access.
