# Wildfire/Flood Insurance Appeal Agent — Build Spec

## What this is

An agent that helps homeowners fight wrongful insurance non-renewals or premium hikes that are justified by wildfire or flood risk. Insurers often flag properties using coarse, outdated, or ZIP-code-level risk models. This agent pulls parcel-level, cited federal data via Mireye, cross-references it against the insurer's own public rate filing rationale and real wildfire/flood event history, detects mismatches, and drafts a formal appeal.

Built for the Mireye Build Challenge. Judging criteria: (1) what we combined Mireye with, (2) is it a real problem, (3) who writes the check. This spec is designed to hit all three.

## The core loop

1. **Input**: an address (or a non-renewal/premium notice the user pastes in — extract the address and stated reason from it)
2. **Geocode**: resolve the address to canonical coordinates via Mireye
3. **Fetch physical facts**: pull the `wildfire_underwrite` and/or `flood_risk` field presets for that parcel via Mireye — defensible space, slope, distance to fuel/wildland-urban interface, flood zone, elevation, base flood elevation, etc. Every field comes back cited and timestamped.
4. **Fetch the second data source**: pull wildfire perimeter history (NIFC or CAL FIRE public data) near the parcel, and/or the insurer's stated risk model rationale from public rate filings (state DOI / SERFF filings where available)
5. **Reconcile**: compare what the insurer claims (e.g. "high wildfire risk zone") against what Mireye's cited data actually shows for this specific parcel (e.g. no fire perimeter within X miles in Y years, low slope, defensible space present)
6. **Act**: if there's a real mismatch, generate a structured appeal letter citing the specific sourced facts, ready to file with the insurer or the state Department of Insurance

This is the "agent" part the challenge requires — it isn't just displaying data, it detects a trigger, gathers from multiple independent sources, reasons about a conflict between them, and produces an output document.

## Data sources

### Mireye (primary)
- `POST /v1/geocode` — address to coordinates, 1 credit
- `POST /v1/fetch` with `wildfire_underwrite` preset (6 fields) and `flood_risk` preset (13 fields) — 1 credit per field per location
- Optional: `POST /v1/ask` for a natural-language sanity check on a given parcel, 10 credits
- Sign up with code `BUILD` for a free Build-tier account
- Docs: https://docs.mireye.ai

### Second dataset (the "weird" combination) — pick ONE for the demo, don't try to build both
**Option A — Wildfire perimeter history (recommended, simpler to integrate)**
- NIFC (National Interagency Fire Center) public perimeter data, or CAL FIRE's public GIS perimeter datasets for California
- Use to check: has an actual fire occurred within N miles of this parcel in the last M years? This directly tests the insurer's "high risk" claim against real event history.

**Option B — State insurance rate filings**
- California SERFF filings (public, searchable) or state DOI complaint/rate filing data
- Harder to parse programmatically in a short build — treat as a stretch goal or use 2-3 hardcoded example filings for the demo rather than live integration

For the hackathon build: use Option A live, and hardcode 1-2 example rate filing rationales as reference text for the reconciliation step. This keeps scope tight while still showing the full loop.

## Demo scope (what to actually build in the time available)

- A small set of hardcoded demo addresses (5-10), ideally real California or Florida addresses with a mix of "insurer flag looks justified" and "insurer flag looks wrong" cases, so the demo shows the agent correctly distinguishing both, not just always finding a mismatch
- A simple interface (CLI or minimal web UI) where you input an address + the insurer's stated reason for non-renewal/hike
- The agent runs the full loop live against real Mireye API calls (this matters for the judges — show real cited data, not mocked)
- Output: a rendered appeal letter/memo with every claim tied to a source and timestamp, same visual language as Mireye's own "with citation" demo on their homepage — lean into that, it signals you understood their product

## Build order (suggested, for two people)

**Person 1 — Mireye integration + reasoning core**
1. Set up Mireye account (code `BUILD`), test geocode + fetch calls against a couple of known addresses
2. Build the reconciliation logic: given insurer's stated reason + Mireye's cited facts, determine mismatch or match, with a clear explanation
3. Wire this into an agent loop (Claude API, tool-calling) so it's genuinely agentic rather than a fixed script — the agent should decide which fields to fetch based on the insurer's stated reason, not always fetch everything

**Person 2 — Second dataset + output**
1. Pull wildfire perimeter data for the demo addresses (NIFC/CAL FIRE), preprocess into something easily queryable (distance from parcel to nearest perimeter, most recent fire year)
2. Build the appeal letter template — should read like something a homeowner could actually file, formal tone, every fact cited with source + date
3. Build the minimal UI/CLI wrapper to run the full loop end to end

**Both — final**
1. Run the 5-10 demo addresses through the full pipeline, sanity check the outputs make sense
2. Write the submission narrative: what we combined Mireye with, why this is a real problem (cite real examples of CA/FL insurer pullouts if available), who writes the check (homeowners directly, or better — a property management company running this across a portfolio)

## Why this fits the challenge rubric

- **Combination**: Mireye (parcel-level cited physical data) + wildfire perimeter history + insurer rate filing rationale — not a pairing anyone would expect
- **Real problem**: non-renewals and premium spikes are costing homeowners thousands of dollars right now, often based on risk models coarser than what Mireye can prove at the parcel level
- **Who pays**: homeowners facing a $2,000-5,000/year hit (a one-time appeal-generation fee is trivial against that), or a stronger B2B angle — a property manager running this across a multi-unit portfolio
- **It's an agent, not a dashboard**: it detects a trigger, pulls from multiple independent sources, reconciles a real conflict, and produces an actionable document — not just a map with data on it
- **Can't be faked by a generic LLM**: the whole thesis is that insurer risk flags are often too coarse, and only parcel-level cited data can prove that. A model guessing from training knowledge would just repeat the same generic risk assessment the insurer already gave.

## Open questions to resolve before/during build

- Which state to focus the demo on (California has the most active non-renewal news cycle and the most accessible public wildfire perimeter data — recommend starting there)
- Whether to attempt live rate-filing lookup or just hardcode 1-2 reference filings (recommend hardcoding for time)
- Whether the output is homeowner-facing (appeal letter) or portfolio-facing (batch screening report) — pick one framing for the demo narrative, mention the other as the natural next step