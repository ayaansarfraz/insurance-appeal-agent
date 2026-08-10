# Wildfire/Flood Insurance Appeal Agent

An agent that helps homeowners fight wrongful insurance non-renewals or premium hikes justified by wildfire or flood risk.

Insurers often flag properties using coarse, ZIP-code-level risk models. This agent pulls parcel-level, cited federal data via [Mireye](https://docs.mireye.ai), cross-references it against real CAL FIRE wildfire perimeter history, detects mismatches, and drafts a formal appeal letter with every claim tied to a source and timestamp.

Built for the Mireye Build Challenge.

## The loop

1. **Input** — the property address, and the insurer's stated reason pasted verbatim from the non-renewal or premium notice
2. **Geocode** — resolve to canonical coordinates via Mireye
3. **Fetch physical facts** — `wildfire_underwrite` / `flood_risk` field presets for the parcel, cited and timestamped
4. **Fetch second source** — wildfire perimeter history (NIFC / CAL FIRE) near the parcel
5. **Reconcile** — compare the insurer's claim against what the cited parcel-level data actually shows
6. **Act** — on a real mismatch, generate a structured, source-cited appeal letter ready to file with the insurer or state DOI

## What is built

The full loop runs end to end against the live Mireye API and a real CAL FIRE
perimeter extract. Nothing in the pipeline is mocked.

- `lib/mireye.ts` — geocode and field-preset fetch, translating Mireye's
  snake_case wire format into the internal cited-field contract
- `lib/fire-data.ts` — 7,298 California perimeters, 2006 onward, queried locally
  with turf.js for nearest-perimeter distance, containment and fires-within-radius
- `lib/agent.ts` — Claude tool-calling loop. The agent chooses which field
  presets to fetch based on the insurer's stated reason rather than fetching
  everything, which is the cost control the design depends on. Across the demo
  set it selects `wildfire_underwrite` and never spends credits on the 13
  `flood_risk` fields.
- `lib/citation-guard.ts` — every claim the agent makes is checked against the
  sources actually fetched for that parcel. Unverifiable claims are stripped, and
  an unverifiable conclusion blocks both the letter and the verdict banner rather
  than being displayed with a caveat.
- `lib/letter-template.ts` — the appeal letter, addressed to the carrier
- `app/page.tsx` — single-page UI, verdict first, every value shown with source
  and fetch timestamp

## Running it

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY and MIREYE_API_KEY
npm run dev
```

Verification (the first two cost API credits, the third is free):

| command | what it checks |
| --- | --- |
| `npm run verify:agent -- --all` | all 10 demo parcels end to end, scored against `expectedMismatch` |
| `npm run verify:mireye` | the live Mireye client against known addresses |
| `npm run verify:fire` | perimeter geometry, projection and distance sanity |

Run `verify:agent` after any change to `lib/agent-prompt.ts`. A prompt edit that
improves one parcel has twice silently broken another.

## Scope notes

- California only. The perimeter extract is CAL FIRE FRAP, 2006 onward.
- Rate filings are not integrated. PROJECT.md floated hardcoding a reference
  SERFF filing for context; the parcel data and perimeter history proved
  sufficient to reconcile the insurer's stated reason without it.
- Mireye publishes no defensible-space or WUI-distance field. The
  `wildfire_underwrite` preset is six fields: elevation, slope, LCMS class, tree
  canopy, current NDVI and 5-year NDVI change. The letter never claims otherwise.

See [PROJECT.md](PROJECT.md) for the full build spec and [CLAUDE.md](CLAUDE.md)
for the engineering log.
