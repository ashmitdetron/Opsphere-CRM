# OPSphere CRM — Frontend

Next.js 16 App Router frontend for the OPSphere CRM platform.

**GitHub:** https://github.com/detronautomation/Opsphere-CRM

## Stack

- **Framework:** Next.js 16.2 (App Router)
- **Language:** TypeScript 5
- **UI:** React 19
- **Styling:** Tailwind CSS v4 (`@theme inline` CSS variables)
- **Icons:** Lucide React
- **Utilities:** clsx

## Setup

```bash
npm install
npm run dev     # http://localhost:3000
```

The frontend expects the backend running at `http://localhost:3003`. All API calls go through `src/lib/api.ts` which attaches the stored access token and handles 401 refresh flows automatically.

## Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   └── (dashboard)/
│       ├── layout.tsx                # Sidebar navigation + auth guard
│       ├── dashboard/page.tsx        # Overview stats
│       ├── campaigns/
│       │   ├── page.tsx              # Campaign list
│       │   ├── new/page.tsx          # Create campaign with ICP + brand voice
│       │   └── [id]/page.tsx         # Campaign detail: KPIs, stage breakdown, prospect table
│       ├── prospects/
│       │   ├── page.tsx              # Prospect list with filters + bulk actions
│       │   ├── [id]/page.tsx         # Prospect detail + pipeline timeline
│       │   ├── kanban/page.tsx       # Drag-and-drop Kanban board (HTML5 DnD)
│       │   └── import/page.tsx       # Drag-and-drop CSV import
│       ├── leads/page.tsx            # CRM leads + inline convert-to-prospect
│       ├── messages/page.tsx         # Outreach message queue (approve/reject/send)
│       ├── pipeline/page.tsx         # Full pipeline event feed
│       ├── appointments/
│       │   ├── page.tsx              # Appointment list with quick actions
│       │   └── new/page.tsx          # Schedule discovery call
│       ├── brand-voices/page.tsx     # Brand voice management
│       └── settings/page.tsx         # Org settings + account info
├── components/
│   ├── sidebar.tsx                   # Navigation sidebar
│   └── page-header.tsx              # Reusable page title + description
└── lib/
    ├── api.ts                        # Fetch wrapper with auth + auto-refresh
    ├── auth-context.tsx              # Auth state (user, entity, tokens)
    ├── types.ts                      # TypeScript interfaces
    └── utils.ts                      # Formatters, status color helpers
```

## Pages

| Route | Description |
|-------|-------------|
| `/login` | Login form |
| `/register` | Register organisation + owner account |
| `/dashboard` | Stats overview (prospects, messages, meetings, replies) |
| `/campaigns` | Campaign list with status badges and prospect counts |
| `/campaigns/new` | Create campaign — ICP definition + brand voice picker |
| `/campaigns/[id]` | Campaign detail: KPI cards, stage breakdown, bulk-enrich, per-row actions |
| `/prospects` | Filterable prospect list with enrichment and pipeline status |
| `/prospects/[id]` | Prospect detail: profile, enrichment data, messages, pipeline timeline |
| `/prospects/kanban` | Drag-and-drop Kanban board across all 9 pipeline stages |
| `/prospects/import` | Drag-and-drop CSV upload with column format guide |
| `/leads` | CRM leads with inline stage management and convert-to-prospect flow |
| `/messages` | Outreach message queue with approve/reject/send actions |
| `/pipeline` | Full pipeline event feed across all campaigns |
| `/appointments` | Appointment list with complete / no-show / cancel quick actions |
| `/appointments/new` | Schedule a discovery call |
| `/brand-voices` | Manage brand voice profiles (tone, avoid phrases, example messages) |
| `/settings` | Organisation profile + account info + API key reference |

## Auth Flow

1. `POST /api/auth/login` → receives `{ access_token }` in response body + `refresh_token` in httpOnly cookie
2. Access token stored in `localStorage`, attached as `Authorization: Bearer <token>` to all API requests
3. On 401, the `api()` helper automatically calls `POST /api/auth/refresh` using the httpOnly cookie and retries the original request
4. If refresh fails, user is redirected to `/login`

## Styling

Tailwind CSS v4 uses CSS custom properties defined in `app/globals.css`:

```css
@theme inline {
  --color-background: ...;
  --color-foreground: ...;
  --color-accent: ...;
  --color-muted: ...;
  --color-border: ...;
  --color-card: ...;
  --color-accent-foreground: ...;
}
```

All components use semantic Tailwind tokens (`bg-background`, `text-foreground`, `border-border`, `bg-accent`, etc.) for consistent theming.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build |
| `npm start` | Run production build |
| `npm run lint` | ESLint |
