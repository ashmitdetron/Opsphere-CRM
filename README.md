# OPSphere CRM

> Full-stack B2B outbound sales automation platform — multi-source prospect discovery, AI-powered message generation, and pipeline management.

**GitHub:** https://github.com/detronautomation/Opsphere-CRM

## Repository Structure

```
Opsphere-CRM/
├── OPSphere-CRM-Backend/   # Express 5 + TypeScript API (port 3003)
└── opsphere-crm-ui/        # Next.js 16 + React 19 frontend (port 3000)
```

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- pnpm or npm

### 1 — Database

```bash
# Run all migrations in order
psql $DATABASE_URL -f OPSphere-CRM-Backend/src/db/migrations/001_crm_schema.sql
psql $DATABASE_URL -f OPSphere-CRM-Backend/src/db/migrations/003_add_crm_leads.sql
psql $DATABASE_URL -f OPSphere-CRM-Backend/src/db/migrations/004_multi_source.sql
```

### 2 — Backend

```bash
cd OPSphere-CRM-Backend
cp .env.example .env   # fill in your API keys
npm install
npm run dev            # http://localhost:3003
```

### 3 — Frontend

```bash
cd opsphere-crm-ui
npm install
npm run dev            # http://localhost:3000
```

## Feature Overview

| Module | Description |
|--------|-------------|
| **Campaigns** | Define ICP, run multi-source discovery, track pipeline metrics |
| **Campaign Detail** | KPI stat cards, stage breakdown filters, per-row enrich/generate, bulk-enrich |
| **Prospects** | Filterable list with enrichment and pipeline status |
| **Kanban Board** | Drag-and-drop prospect cards across all 9 pipeline stages |
| **Prospect Detail** | Full profile, enrichment data, messages, and pipeline event timeline |
| **CSV Import** | Drag-and-drop CSV upload with column format guide |
| **Leads** | Lightweight inbound lead capture with stage tracking and campaign conversion |
| **Messages** | AI-generated LinkedIn outreach with approve / reject / edit / send flow |
| **Pipeline** | Funnel analytics, campaign performance table, and pipeline event log |
| **Appointments** | Book, track, and action discovery calls |
| **Brand Voices** | Define tone, value proposition, and style for AI message generation |
| **Settings** | Organisation profile, account info, and API key reference |

## Discovery Sources

The discovery agent runs all configured sources concurrently and deduplicates results:

| Source | API Key | Description |
|--------|---------|-------------|
| **Serper** | `SERPER_API_KEY` | Google LinkedIn SERP (primary) |
| **Apollo.io** | `APOLLO_API_KEY` | B2B people & company database |
| **Bing Search** | `BING_SEARCH_KEY` | LinkedIn SERP via Bing (fallback) |

## Enrichment Sources

The enrichment agent cascades through sources and merges the best available data:

| Source | API Key | Description |
|--------|---------|-------------|
| **Proxycurl** | `PROXYCURL_API_KEY` | LinkedIn profile enrichment |
| **Hunter.io** | `HUNTER_API_KEY` | Professional email finder |
| **Clearbit** | `CLEARBIT_API_KEY` | Company data enrichment |
| **Web scrape** | *(none)* | Meta description from company website |

## Tech Stack

- **Backend:** Express 5, TypeScript, PostgreSQL (`pg`), Zod, JWT, bcrypt, Multer
- **Frontend:** Next.js 16 App Router, React 19, Tailwind CSS v4, Lucide React
- **AI:** Anthropic Claude (`claude-sonnet-4-20250514`)
- **Outreach:** PhantomBuster (LinkedIn automation)
