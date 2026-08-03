# UI Redesign Brief — Insurance Appeal Agent

Read this alongside `CLAUDE.md` and `PROJECT.md` before touching any component. This brief covers visual direction and information architecture only, it does not change the agent logic, data contracts, or API routes in `lib/`.

## The brief, in one line

A California-grounded, document-like interface that makes "insurer's vague claim versus our cited parcel-level proof" instantly readable, where the verdict is the hero and every fact is scannable, not a wall of text.

## What's wrong with the current UI

Per user feedback: results read as dense, undifferentiated text. The core problem is the citation cards and reconciliation output currently present as a list, with no visual hierarchy separating "the claim," "the verdict," and "the proof." The interface needs to do the reading for the user, not hand them a transcript.

## Design plan

### Color

Direction confirmed against a reference the user liked: warm paper background, a single restrained amber/gold accent, everything else quiet neutrals. Drop the multi-accent chaparral/ember/gold-hour palette from the earlier draft in favor of this tighter system:

- `--paper` `#F5F2EC` — warm off-white background, official document stock
- `--ink` `#2A2723` — warm near-black for headings and primary text
- `--ink-muted` `#6B665D` — warm grey for body copy, descriptions, secondary text
- `--rule` `#DDD6C7` — hairline border/divider color for cards and table rows
- `--amber` `#B8873D` — the single accent color, used for eyebrows, step labels, the deadline/verdict callout border, active-state dots on the timeline, and links. This is the only saturated color on the page, everything else is neutral.
- `--amber-tint` `#FBF0DA` — pale amber fill, used only for small pill/tag backgrounds (e.g. a "Reviewed" or "Cited" tag), never for large surfaces

One accent color total. If a state needs distinguishing (e.g. mismatch found versus claim supported), do it with amber intensity/weight and an icon or label change, not by introducing a second hue, that's what keeps this reading as restrained rather than a status-color dashboard.

Five named colors, no gradients. This is a document, not a landing page, restraint matters more than richness here.

### Type

Matches the reference's pairing: a warm editorial serif for headlines against a clean sans for everything else, not a slab serif, the reference reads more literary/legal-document than industrial-stamped.

- **Display / headings**: a high-contrast text serif, Newsreader, Lora, or Source Serif 4, used for the page title ("Appeal for Policy..." style treatment), section headings ("What the record shows"), and the verdict statement itself. Set large, normal weight or medium, not bold, the reference's headline is confident through size and letterforms, not boldness.
- **Body / UI**: a clean grotesk (Inter or system sans) for descriptions, labels, buttons, eyebrows (small caps or letter-spaced uppercase, per the reference's "STEP 1" and "APPEAL DEADLINE" treatment), and table headers
- **Data / citations**: keep a monospace face (IBM Plex Mono) exclusively for source names, timestamps, and field values in citation rows, this still differentiates "verifiable data" from prose within the new type system

### Layout concept

Reference structure adopted directly: a header with small bordered eyebrow tags, a title in the display serif, a descriptive subline, and a bordered callout box in the top right for the verdict, mirroring the reference's "APPEAL DEADLINE / 17 days" box. Below that, a two-column grid: main content cards on the left (wider), a right sidebar with a timeline and a checklist.

```
┌──────────────────────────────────────────┬─────────────────┐
│ [Parcel record reviewed] [Ridgecrest       │ ┌─────────────┐ │
│  Fire · June 2026]                         │ │VERDICT       │ │
│                                             │ │Mismatch found│ │ ← bordered
│ Appeal for [address]                       │ │or Claim      │ │   callout,
│ (large serif headline)                     │ │supported     │ │   amber
│                                             │ └─────────────┘ │   border,
│ One-line summary of the finding            │                 │   same slot
│                                             │                 │   as reference
├─────────────────────────────────────────────┤ Case timeline   │
│ STEP 1                                     │ ● Notice received│
│ What the insurer says                      │ ● Parcel geocoded│
│ "High wildfire risk" — [quoted reason]     │ ● Fire history   │
│                                             │   checked        │
├─────────────────────────────────────────────┤ ● Reconciled     │
│ STEP 2                                     │ ○ Letter (if any)│
│ What the parcel record shows               │                 │
│ [field] · [source] · [date]                │ Supporting facts│
│ [field] · [source] · [date]                │ ✓ fact one       │
│ [field] · [source] · [date]                │ ✓ fact two       │
│                                             │ ✓ fact three     │
├─────────────────────────────────────────────┤                 │
│ STEP 3 (only if mismatch)                  │                 │
│ Generate appeal letter  [ Generate ]        │                 │
└─────────────────────────────────────────────┴─────────────────┘
```

This replaces the earlier stamp-hero concept. The reference does the "make the verdict impossible to miss" job with a bordered callout box in a fixed top-right slot, not a large centered graphic, that's a cleaner solution and matches the ask directly, adopt it as-is rather than inventing a new hero treatment.

### Signature element: the verdict callout + case timeline

The one memorable pairing on this page, taken straight from the reference:

- **Verdict callout box**: top-right, amber-bordered rectangle (not circular, not rotated, follow the reference exactly), small letter-spaced label at top ("VERDICT" or "PARCEL FINDING"), then a large serif statement below it ("Mismatch found" or "Claim supported"), then one line of muted context (e.g. "3 of 4 cited facts contradict the stated reason"). For `partiallySupported`, the label reads "Partially supported" with a muted amber tone, still one accent color, communicated through the words and a lighter fill rather than a new hue.
- **Case timeline**: the right-sidebar dot-timeline from the reference, repurposed to show the agent's actual reasoning trace (notice received → parcel geocoded → hazard preset fetched → fire history checked → reconciled → letter generated or withheld). Filled amber dots for completed steps, hollow grey dots for steps not applicable to this case (e.g. letter step when no mismatch found). This is a direct, better solution to the "reasoning trace" requirement from the original brief, use the timeline pattern instead of a generic collapsible accordion.
- **Evidence checklist**: reference's checkmark-list pattern (`✓ Roof inspection report`), repurposed to list the supporting cited facts from `ReconciliationResult.supportingFacts`, each line a fact with a checkmark, source and timestamp in the muted monospace style on hover or as a smaller sub-line

### California grounding (explicit ask)

- Small bordered eyebrow tags at the top, matching the reference's "Denial received / Ridgecrest Fire · June 2026" pattern, e.g. "Parcel record reviewed" + "[fire name or region] · [year]," makes the California/fire-event scope explicit on load without needing a texture or illustration
- Headline itself should name the address or region directly ("Appeal for [parcel address]"), not a generic product title, this alone carries most of the California grounding
- No topographic texture, no map, no flame icon. The reference achieves specificity through copy and structure (real-sounding labels, a named fire event, a policy number), not through decoration, follow that lead, it's a cleaner solution and matches "clean and superior" more directly than a background texture would

## Component-level changes

Map this onto the existing files listed in `CLAUDE.md`:

- **`app/page.tsx`** — restructure into: header (eyebrows + serif title + verdict callout in top-right) → left column of numbered "STEP" cards (insurer's claim, parcel record, letter action) → right sidebar (case timeline + supporting facts checklist). Demo address chips move to a lighter-weight picker above the header, not competing with the verdict callout.
- **`app/components/citation.tsx`** — keep the existing `CitationCard`/`CitedValue` pattern for the "parcel record shows" step, but tighten it: one fact per row, monospace value + source + timestamp on one line, not stacked across three lines. This is the direct fix for "seems like a lot of text."
- **New component: `app/components/verdict-callout.tsx`** — the bordered top-right box described above, takes `mismatchFound` and `partiallySupported` from `ReconciliationResult` and renders label + serif statement + one-line context
- **New component: `app/components/case-timeline.tsx`** — right-sidebar dot timeline, filled amber dots for completed steps in the tool-call sequence (geocoded → hazard preset fetched → fire history checked → reconciled → letter generated/withheld), hollow dots for inapplicable steps. This addresses "show the agent's reasoning path" and directly replaces the earlier collapsible-accordion idea with the reference's cleaner pattern.
- **New component: `app/components/evidence-checklist.tsx`** — checkmark list of `supportingFacts`, matching the reference's checklist pattern, monospace source/timestamp as a muted sub-line under each fact
- **Letter panel** — only renders when `mismatchFound && citations pass` per existing logic in `route.ts`, keep that gating, present as its own numbered step card ("STEP 3 · Generate appeal letter") matching the left-column card style, not a separate visual treatment

## Explicit non-goals for this pass

- Do not touch `lib/agent.ts`, `lib/mireye.ts`, `lib/citation-guard.ts`, or any reconciliation logic, this is a presentation-layer pass only
- Do not add a map component
- Do not add animation beyond a light fade-in on the verdict callout when results land (under 300ms) and standard hover states, this is a document, not a landing page, restraint applies to motion too
- No em dashes in any UI copy or generated letter text
- Keep everything responsive down to mobile and keep visible keyboard focus states, this still needs to demo cleanly on whatever device the judges use

## Build order

1. Establish the design tokens (color/type variables) in `globals.css` or the Tailwind config first, before touching any component, so every subsequent piece pulls from the same system
2. Build `verdict-callout.tsx` in isolation, screenshot it against all three states (mismatch, supported, partial) before wiring it into the page
3. Restructure `page.tsx` into the header + two-column layout
4. Rebuild the citation display for density (one line per fact)
5. Add the collapsible reasoning trace
6. Re-run `npm run verify:agent -- --all` to confirm no regression in the underlying logic, this pass should be visually different, functionally identical
7. Screenshot the full page at both a supported-claim demo address and a mismatch-found demo address, compare against this brief before considering it done