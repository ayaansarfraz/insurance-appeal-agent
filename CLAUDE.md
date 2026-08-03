# CLAUDE.md — Wildfire/Flood Insurance Appeal Agent

This file is the persistent memory for this project. Read it in full before starting work each session. When you hit a bug, a wrong assumption, or something that wastes time, add it to the **Lessons Learned** section at the bottom before you move on — that section exists specifically so the same mistake doesn't happen twice across sessions.

## Project summary

An agent that takes a homeowner's insurance non-renewal or premium-hike notice, pulls cited parcel-level physical data from Mireye, cross-references it against real wildfire perimeter history, detects whether the insurer's stated risk rationale actually holds up for this specific parcel, and generates a formal appeal letter with every claim sourced and timestamped. Built for the Mireye Build Challenge, deadline August 10 2026.

Full functional spec: see `PROJECT.md` in this repo. This file (CLAUDE.md) is about how to build it, not what to build.

## Stack

**Framework: Next.js 15 (App Router), TypeScript**
Chosen because it's the stack already proven out on a prior project (AurumOS), so no ramp-up time, and it lets one codebase handle both the UI and the agent backend via API routes, no separate server to stand up under deadline pressure.

- **Frontend**: Next.js App Router, Tailwind CSS for styling, minimal — this is a demo, not a product, don't over-invest in UI polish beyond making the citation/source display look clean (mirror Mireye's own "with citation" card style from their homepage, it signals product understanding to judges)
- **Backend**: Next.js API routes (`app/api/*/route.ts`) — one route to run the full agent pipeline, keep it server-side so API keys never touch the client
- **Agent / reasoning**: Anthropic API (Claude), tool-calling / function-calling pattern — the agent should decide which Mireye fields to request based on the insurer's stated reason, not blindly fetch everything. Use the standard `/v1/messages` endpoint with `tools` defined for `mireye_geocode` and `mireye_fetch`.
- **Geospatial**: `turf.js` for point-to-polygon and distance calculations against the wildfire perimeter GeoJSON (e.g. "distance from parcel to nearest fire perimeter")
- **Data**: wildfire perimeter data downloaded once from NIFC/CAL FIRE as GeoJSON, stored as a static file in the repo (`/data/fire-perimeters.geojson`), queried locally — no live scraping, no external DB needed for a demo this size
- **State**: no database. This is a stateless demo — input address in, output letter out. Do not add Postgres/Supabase/etc unless a specific feature genuinely requires persistence. Resist the urge to over-engineer this.
- **Deployment**: Vercel (matches Next.js, zero-config, fast to get a live demo URL for judges)

## Environment variables

Create `.env.local` (never commit this file):

```
ANTHROPIC_API_KEY=
MIREYE_API_KEY=
```

Mireye account: sign up at mireye.com/account with code `BUILD` for a free Build-tier month. If credits run low, email founders@mireye.com rather than rationing calls during the demo.

## File structure

```
/app
  /api
    /appeal
      route.ts          # main pipeline endpoint: address + reason in, letter out
  /page.tsx              # single-page UI: input form + output display
/lib
  mireye.ts              # Mireye API client (geocode, fetch, ask)
  fire-data.ts           # wildfire perimeter loading + distance queries (turf.js)
  agent.ts               # Claude tool-calling loop, reconciliation logic
  letter-template.ts     # appeal letter generation
/data
  fire-perimeters.geojson
/PROJECT.md              # functional spec, read this first
/CLAUDE.md               # this file
```

## Core data contracts

Keep these interfaces stable — both halves of the pipeline (Mireye side, fire-data side) are built against them, so changing shape breaks the other person's code.

```typescript
interface ParcelFacts {
  address: string;
  coordinates: { lat: number; lng: number };
  wildfireFields: Record<string, { value: unknown; source: string; fetchedAt: string; confidence: string }>;
  floodFields: Record<string, { value: unknown; source: string; fetchedAt: string; confidence: string }>;
}

interface FireHistoryCheck {
  nearestPerimeterDistanceMiles: number;
  nearestPerimeterYear: number;
  perimeterName: string;
}

interface ReconciliationResult {
  insurerStatedReason: string;
  mismatchFound: boolean;
  explanation: string;
  supportingFacts: Array<{ claim: string; source: string; fetchedAt: string }>;
}
```

## Coding conventions

- TypeScript strict mode on, no `any` unless there's a genuinely good reason (note it inline with a comment if so)
- Server-side only for anything touching API keys — never expose `MIREYE_API_KEY` or `ANTHROPIC_API_KEY` to the client
- Every Mireye field returned to the UI must carry its `source` and `fetchedAt` through to display — dropping citations anywhere in the pipeline defeats the entire point of the project
- Prefer small, single-purpose functions in `/lib` over logic embedded in the route handler — makes it easier to test the reconciliation logic against the hardcoded demo addresses independently of the API layer
- No em dashes in generated letter text or UI copy

## Demo addresses

Maintain a fixed list of 5-10 real addresses in `/data/demo-addresses.ts`, mixing cases where the insurer's flag looks justified and cases where it doesn't, so the demo shows the agent discriminating correctly rather than always finding a mismatch. Do not let this list grow ad hoc during development — decide it early and build/test against it consistently.

## What NOT to do

- Don't build authentication, user accounts, or a database — out of scope for a demo
- Don't attempt live SERFF/rate-filing scraping (Option B from the spec) — hardcode 1-2 reference filings as static text if that context is needed at all
- Don't fetch every possible Mireye field for every parcel by default — the agent should reason about which fields are relevant to the insurer's stated reason first, then fetch. This is also a cost control (fields are billed per field per location)
- Don't spend build time on visual design beyond a clean, credible citation display — function over polish, the judges are evaluating the agent logic and the problem/buyer story, not the UI

## Lessons Learned

*(This section is a living log. Every time a bug, wrong assumption, API quirk, or wasted detour happens, add a dated entry here before ending the session. Keep entries short: what happened, what the fix or correct approach was. Future sessions should read this section before touching related code.)*

- *(no entries yet — first session, add findings here as they come up)*