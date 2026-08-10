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
  source: string;     // populate from FIRE_PERIMETER_SOURCE in lib/fire-source.ts
  fetchedAt: string;  // ditto — do not retype the strings
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

### 2026-08-03 (Agent B: fire data, demo addresses, letter, UI)

- **CAL FIRE's perimeter layer is EPSG:3857, not WGS84.** The FRAP service
  (`California_Historic_Fire_Perimeters/FeatureServer/2`) serves Web Mercator
  metres by default. turf.js assumes WGS84 degrees and will happily compute
  distances from projected metres without throwing, producing numbers that look
  plausible and are wrong by orders of magnitude. Fix: pass `outSR=4326` on the
  ArcGIS query so the server reprojects. `lib/fire-data.ts` now also asserts at
  load that sampled feature bboxes fall inside California's WGS84 bounding box,
  so a future bad extract fails loudly instead of silently.
- **Don't trust recalled "known" distances as test fixtures.** The first version
  of `scripts/verify-fire-data.mjs` failed three landmark checks and looked like
  a real projection bug. turf was right; the expected values were wrong from
  memory (one of them was a driving distance, not a straight line). Recomputing
  them from the WGS84 Vincenty inverse made everything pass. If a geospatial
  test fails, verify the expectation before touching the code.
- **Size numbers for the perimeter extract.** CA + 2006 onward is 7,331 features
  and 10.5 MB raw from ArcGIS. After Douglas-Peucker at 0.0006 degrees and
  rounding coordinates to 4 decimals, it is 7,298 features / 6.4 MB (1.5 MB
  gzipped). Simplification error was measured against full resolution source
  geometry: worst case 166 ft, most cases under 10 ft, against a reporting
  granularity of 0.1 mile. Do not simplify harder without re-measuring.
  `scripts/build-fire-perimeters.mjs` regenerates the file.
- **Next traces `path.join(process.cwd(), 'data', ...)` automatically.** No
  `outputFileTracingIncludes` entry was needed in `next.config.ts`; the
  `.nft.json` for the appeal route already lists the geojson. Confirm with
  `grep fire-perimeters .next/server/app/api/appeal/route.js.nft.json` after any
  change to how the file is loaded.
- **`FireHistoryCheck` in `lib/types.ts` carries no `source`/`fetchedAt`.** Every
  other value in the pipeline does. Rather than edit the frozen contract, the
  dataset provenance lives in `lib/fire-source.ts` as a constant that both the
  server and the client import. That is arguably more correct anyway, since the
  citation belongs to the dataset rather than to an individual query. If the
  contract is ever unfrozen, adding citation fields to `FireHistoryCheck` is the
  cleaner fix.
  **RESOLVED same day, see the amendment entry below.**

### 2026-08-03 (main: contract amendment after merging Agent B)

- **`FireHistoryCheck` now carries `source` and `fetchedAt`.** The freeze existed
  to stop two parallel agents churning a shared contract, and Agent A had not
  started yet, so the amendment was free at that moment and would not have been
  a week later. `lib/fire-source.ts` remains the single definition of the
  provenance strings and `nearestFirePerimeter` populates the new fields from
  `FIRE_PERIMETER_SOURCE`. The values are still defined in exactly one place;
  the type now guarantees they travel with every result, so a fire-history claim
  cannot reach the letter uncited. Update the citation in `fire-source.ts` only.
- **Timing rule this illustrates:** a frozen contract is only worth its cost
  while more than one stream is writing against it. When exactly one stream is
  live, amend it immediately rather than accumulating workarounds around it.
- **`package.json` was named `scaffold`.** `create-next-app` refuses to run in a
  non-empty directory, so Phase 0 scaffolded into a temp dir and copied the
  result in, which carried that directory's name across. Renamed to
  `insurance-appeal-agent`.
- **`scripts/verify-fire-data.mjs` needs the TS resolve hook.** Running it as
  plain `node scripts/verify-fire-data.mjs` fails with `ERR_MODULE_NOT_FOUND` on
  the extensionless `./fire-source` import. Use `npm run verify:fire`, which
  passes `--experimental-strip-types --import ./scripts/ts-resolve.mjs`.

### 2026-08-03 (Agent A: live Mireye API verified)

- **The base URL is `api.mireye.com`, not `api.mireye.ai`.** The `.ai` host does
  not resolve at all (`curl: (6) Could not resolve host`). Docs are served from
  `docs.mireye.ai`, which is where the wrong assumption in the Phase 0 stub came
  from. Auth is `Authorization: Bearer $MIREYE_API_KEY`.
- **Wire format is snake_case and carries more than the frozen contract
  modelled.** Every field comes back as `{value, unit, source, source_url,
  confidence, fetched_at, dataset_vintage, ttl_seconds, notes, status}`. The
  `CitedField` assumption was close but not exact, so `lib/mireye.ts` is the
  translation boundary: nothing above it sees snake_case. `unit` and
  `source_url` were added to `CitedField` as optional fields — `unit` because
  "slope 12.4" is ambiguous and "slope 12.4 degrees" is not, `source_url`
  because the whole premise is that a regulator can re-fetch each citation.
  `/v1/fetch` takes `{lat, lng, preset}` and also returns a `partial_failures`
  array; a field with `status != "ok"` is dropped rather than cited.
- **THE BIG ONE: Mireye's wildfire fields read BENIGN for a parcel inside the
  deadliest wildfire perimeter in California history.** 6295 Skyway, Paradise
  sits inside the 2018 Camp Fire perimeter and returns slope 1.28 degrees, tree
  canopy 1 percent, NDVI 0.06, `lcms_class` "Barren or Impervious". Every
  vegetation-derived signal is low *because the town burned down*. A reconciler
  reading only `wildfire_underwrite` would confidently tell a Paradise homeowner
  their insurer is wrong. The fire perimeter cross-reference is not a
  nice-to-have second source, it is the thing that stops the product from being
  catastrophically wrong, and the agent prompt must state that low vegetation
  can mean recently burned rather than low hazard.
- **`wildfire_annual_frequency` returned 0 for all four addresses sampled,
  including Paradise.** It is the FEMA National Risk Index tract-level figure
  and lives in the `natural_hazard` preset, not `wildfire_underwrite`. The plan
  to use it as a stand-in for "the insurer's coarse model" does not work while
  it reads zero next to a 153,000-acre burn scar. Do not cite it as evidence
  either way until someone works out whether it is unpopulated for these tracts
  or scaled differently.
- **There is no defensible-space or WUI-distance field.** PROJECT.md assumes
  "defensible space, distance to fuel/wildland-urban interface". The real
  `wildfire_underwrite` preset is exactly six fields: `elevation`,
  `slope_degrees`, `lcms_class`, `tree_canopy_pct`, `ndvi_current`,
  `ndvi_change_5y`. Do not promise defensible space in the letter or the
  submission narrative.
- **`GET /v1/meta/fields` is worth reading before prompting the agent.** Each
  field ships an `interpretation_hints` string written for exactly this use
  case, e.g. slope: "Slope >15 degrees materially raises wildfire spread risk on
  forested land." Feed these to the model rather than inventing thresholds.
- **A demo address was mislabelled and the live data caught it.** 300 Esplanade
  Dr, Oxnard was listed `expectedMismatch: true` on the stated basis that all
  nearby fires were 30-67 acre grass fires. The committed extract says otherwise:
  20 fires within 5 miles including Thomas 2017 (281,791 acres, 4.4 mi),
  Mountain 2024 (19,902 acres, 4.0 mi) and Maria 2019 (10,043 acres, 4.8 mi).
  Flipped to `expectedMismatch: false`. Lesson: verify a demo address's notes
  against `firesWithinRadius` output before trusting them, including notes
  written by an earlier session.
- **The pipeline produced a self-contradicting appeal letter, and only running
  it caught it.** With `lib/agent.ts` still a stub, a live request for the
  Paradise parcel returned a letter whose section 3 said "This parcel falls
  inside the recorded perimeter of the Camp Fire of 2018" and whose section 4
  said "Nearest recorded fire perimeter is 7.3 miles away and dates to 2017",
  citing a source that does not exist, alongside a defensible-space claim for a
  field Mireye does not even publish. It typechecked and built cleanly the whole
  time. Fix: `lib/citation-guard.ts`, which checks every supporting fact's
  citation against the sources actually fetched for that parcel and refuses to
  render a letter otherwise. Keep it after the agent is real — inventing a
  plausible citation is a failure mode language models have natively, not a
  property of the stub.
- **Blocking the letter was not enough; the verdict banner leaked the same
  fabrication.** First version of the guard stopped the document but left the
  UI rendering the unverified explanation as a headline conclusion: "The stated
  reason is not supported by this parcel", directly above a card correctly
  showing the parcel is inside the Camp Fire perimeter. Hence
  `explanationTrusted` on `AppealResponse` and a neutral "No verdict yet" state
  in the UI. Rule of thumb: any surface that can state a conclusion needs the
  check, not just the one that produces a file.
- **Never run `npm run build` while `npm run dev` is running.** The production
  build overwrites `.next/` underneath the dev server, which then 500s on every
  request with `ENOENT ... _buildManifest.js.tmp.*`. This looks exactly like a
  broken page: Playwright reported zero inputs, zero buttons, empty DOM. Fix is
  `pkill -f "next dev"; rm -rf .next` and restart, not debugging the app.
  Related: `next build --turbopack` has also thrown a flaky
  `PageNotFoundError: Cannot find module for page: /_document` on App Router
  projects with no `pages/` directory. Production `build` script uses webpack
  (`next build`); keep `--turbopack` on `npm run dev` only.
- **`npm run lint` was linting `.next/` and reporting 4,631 problems.** The
  script was a bare `eslint` with no scope, so it walked generated output. Now
  scoped to `eslint app lib data scripts`, against which the project is clean.
  Also note `cmd | tail && echo PASS` reports tail's exit status, not the
  command's — it will print PASS over a failing lint run.
### 2026-08-03 (Agent A: reconciliation agent live, 10/10 on the demo set)

- **The agent scores 10/10 on verdicts with 0 citation failures.** `npm run
  verify:agent` runs 4 representative parcels, `-- --all` runs all 10, and both
  score against `expectedMismatch`. Run it after any prompt change: a prompt
  edit that improves one parcel can quietly flip another.
- **The Paradise trap is handled, and the prompt is what handles it.** The agent
  now writes, unprompted per-parcel, that low canopy on a burned lot "is what a
  parcel looks like after it has burned and while it is still rebuilding". It
  also does the inverse check on clean parcels, confirming a benign vegetation
  reading is genuine low fuel rather than a burn scar, before concluding for the
  homeowner. That behaviour comes from the trap section in
  `lib/agent-prompt.ts`. Do not trim it.
- **Exposing `alarmDate` fixed a wrong verdict, and no prompt change could
  have.** Santa Monica's insurer claimed "a major wildfire within two miles in
  the last twelve months". The Palisades Fire is 1.4 miles away and the agent
  called the insurer correct, because `firesWithinRadius` returned only `year`
  and a 2025 fire looks recent. The extract has held `alarmDate` all along
  (7,279 of 7,298 features): Palisades ignited 2025-01-07, nineteen months
  before the current date. Exposing that field plus passing today's date into
  the first user message moved the verdict to correct with precise reasoning.
  Lesson: when the agent hedges about a fact ("the records give the year but not
  the month"), check whether the data actually has it before rewriting the
  prompt.
- **The agent skipped Mireye entirely on one parcel.** For Santa Monica it went
  geocode, fire history, submit, and concluded without ever fetching parcel
  measurements, because the fire record looked decisive on its own. Parcel level
  evidence is the entire product thesis, so the prompt now requires fetching the
  preset matching the named hazard before concluding. Watch for this class of
  shortcut whenever a tool is optional.
- **Preset selection is real and observable.** Across all 10 parcels the agent
  chose `wildfire_underwrite` only and never fetched the 13 `flood_risk` fields,
  which is the cost-control claim in `PROJECT.md` demonstrated rather than
  asserted. `presetsChosen` and `toolCalls` come back on the API response so it
  is checkable in the demo.
- **A manual tool loop, not the SDK tool runner.** The loop is about forty lines
  and keeping it explicit makes the agent's preset choice observable. Append the
  whole `response.content` array each turn, never just the text: adaptive
  thinking blocks must be replayed unchanged on the same model, and dropping
  `tool_use` blocks breaks pairing with their results.
- **Route timeout.** A run makes several sequential model calls and takes 26 to
  45 seconds. `app/api/appeal/route.ts` sets `maxDuration = 300`; without it
  this will time out on Vercel.

- **`ReconciliationResult.mismatchFound` being a boolean was a real limitation.**
  RESOLVED: `partiallySupported` added, see the entry below.

### 2026-08-03 (Agent A: partiallySupported, and two regressions it caused)

- **`partiallySupported` is orthogonal to `mismatchFound`, not a third verdict.**
  Either verdict can be two-sided. Oxnard is false + partial (the flag is
  justified on the area's fire record, the parcel measures benign). Santa Monica
  has run true + partial (the twelve month claim is wrong, the megafire is
  real). Keeping them separate avoids a three-state enum that the letter and UI
  would each have to re-derive.
- **A prompt edit flipped Paradise to "appeal this", which is the worst possible
  regression.** Adding the two-sided guidance interacted with the earlier rule
  that a materially false specific claim is a mismatch. The insurer's Paradise
  wording includes "elevated fuel loading", which is genuinely not borne out at
  1 percent canopy, so the agent concluded the reason was contestable for a
  parcel sitting inside the Camp Fire perimeter. The rule had no materiality
  test. Fixed by asking what the decision actually rests on: if removing the
  false claim leaves no stated reason standing it is a mismatch, and if the main
  rationale is independently supported it is not. Both cases are written into
  `lib/agent-prompt.ts` as worked examples. **Run `npm run verify:agent -- --all`
  after every prompt change.** This is the second time an edit that improved one
  parcel silently broke another.
- **The agent submitted an empty `supportingFacts` array.** Prose conclusion,
  zero evidence, which the citation guard would then block with no useful
  explanation. Prompt asks for four to ten facts, the tool schema sets
  `minItems: 3`, and `lib/agent.ts` refuses an empty array at runtime and asks
  again. One retry was not enough, the model resubmitted empty; the bound is now
  3. All ten parcels now return 7 to 9 facts. Treat schema `minItems` as a hint,
  never as enforcement.
- **`partiallySupported` is less stable across runs than `mismatchFound`.**
  Verdicts have held at 10/10 over three consecutive full runs; the two-sided
  flag has moved on Santa Monica between runs. It changes emphasis rather than
  the recommendation, so it is not scored, but do not build anything that
  assumes it is deterministic.
- **Node cannot resolve extensionless TS imports; python here has no CA bundle.**
  Two small detours. Running app `.ts` modules under `node
  --experimental-strip-types` needs the resolve hook in
  `scripts/ts-resolve.mjs`, and `urllib` fails SSL verification in this
  environment so the download path shells out to `curl` (now just uses `fetch`).
- **Demo address balance is 6 justified / 4 mismatch, verified against the real
  extract.** It was drafted 5/5; flipping Oxnard to `expectedMismatch: false` on
  the evidence of the committed extract (see the entry above) made it 6/4, which
  is correct and should not be "rebalanced" back by inventing a tenth case.
  Two of them are deliberately hard: Oxnard has 18 perimeters within
  5 miles that are all small riverbottom grass fires (frequency real, severity
  not), and Santa Monica has a 2025 megafire 1.4 miles away across dense urban
  fabric. If the agent gets those two backwards it is counting perimeters rather
  than reasoning about exposure.
- **Letter audience: the insurer, not the DOI.** A CDI Request for Assistance
  expects the carrier to have been contacted first, so the insurer letter is the
  document that has to exist first, and it is the one with actual leverage. The
  DOI complaint is the follow-on; `lib/letter-template.ts` header explains the
  reasoning and the letter tells the homeowner that is the next step.

### 2026-08-03 (UI redesign per redesign.md: presentation layer only)

- **`truncate` plus a grid track is a page-widening trap, and it is invisible
  until you measure.** The citation rows ellipse long dataset URLs with
  `truncate`, which is `white-space: nowrap`, so the element's *min-content*
  width is the full untruncated string. Grid and flex items default to
  `min-width: auto`, so that min-content propagated all the way up and the whole
  left column rendered 779px wide inside a 390px viewport. Nothing looked broken
  in a screenshot, because the page simply scrolled sideways. Fix is `min-w-0`
  on every link in the chain: the grid children in `page.tsx`, the `StepCard`
  section and its content wrapper, the `CitationGroup` section, and the flex row
  and source span in `CitedValue`. Check with
  `document.documentElement.scrollWidth > window.innerWidth`, not by eye. A
  child element reporting a width past the viewport is fine and expected when it
  sits inside an `overflow: hidden` truncate container; only page scrollWidth
  matters.
- **Screenshot at a real phone width, and assert on it.** A first pass resized
  the viewport to 390 after load and produced an 800px-wide capture, which
  silently tested tablet, not mobile, and missed the overflow entirely. Set the
  viewport when the page is created and assert scrollWidth in the same script.
- **A captured API response is worth more than another live run.**
  `page.route('**/api/appeal', fulfill)` replays one saved `AppealResponse` at
  any viewport, instantly and for free. One live agent run costs 30 to 45
  seconds plus Anthropic and Mireye credits, and the layout question almost
  never needs a fresh one. Capture the JSON on the first real run and replay it
  for everything after.
- **Tailwind v4 utilities are layered, so an unlayered rule beats them.** The
  inputs carry `outline-none`, and the global `:focus-visible` outline in
  `globals.css` still wins, because `@import "tailwindcss"` puts utilities in a
  cascade layer and unlayered rules outrank any layer. Verified by reading
  computed `outlineColor` on the focused element rather than by reasoning about
  specificity, which would have given the wrong answer.
- **AGENT BUG, MITIGATED: the Paradise run leaked raw
  tool-call markup into `explanation` and submitted zero supporting facts.** The
  live response contained the conclusion prose followed by literal
  `</parameter><parameter name="supportingFacts">[{...}]</parameter></invoke>`
  text, with `supportingFacts` as an empty array. So the facts were generated,
  they just landed inside the `explanation` string instead of the structured
  field, and the citation guard then had nothing to verify. The verdict callout
  correctly read "Based on 0 cited facts" and the evidence checklist correctly
  rendered nothing, so the UI degraded honestly, but `explanationTrusted` stayed
  true and the garbage rendered as the headline finding. Two things to chase in
  `lib/agent.ts`: this is the same empty-`supportingFacts` failure mode already
  logged above, so `MAX_EMPTY_FACT_RETRIES` did not catch it, and an explanation
  containing `</parameter>` or `<invoke>` should be rejected outright the way an
  unverifiable citation already is. Reproduced once on Paradise; not yet known
  whether it is deterministic.
