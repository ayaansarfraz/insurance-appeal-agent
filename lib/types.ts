/**
 * FROZEN CONTRACT — do not edit without coordinating both work streams.
 *
 * Agent A (lib/mireye.ts, lib/agent.ts, app/api/appeal/route.ts) and Agent B
 * (lib/fire-data.ts, lib/letter-template.ts, app/page.tsx) both build against
 * these shapes. Changing one breaks the other half of the pipeline silently.
 * If a change is genuinely needed, land it on main first and have both
 * branches rebase.
 */

/** A single Mireye field value with the citation metadata that must survive
 *  all the way to the rendered letter. Dropping source/fetchedAt anywhere in
 *  the pipeline defeats the entire premise of the project. */
export interface CitedField {
  value: unknown;
  source: string;
  fetchedAt: string;
  confidence: string;
  /** Unit of measure, when the field has one ("degrees", "meters", "percent").
   *  Optional because not every Mireye field is dimensioned. Render it with the
   *  value: "slope 12.4" is ambiguous, "slope 12.4 degrees" is not. */
  unit?: string | null;
  /** Link to the underlying dataset. The premise of this project is that an
   *  underwriter or regulator can independently re-fetch any cited value, and
   *  that requires the URL, not just the dataset name. */
  sourceUrl?: string | null;
  /** Dataset edition the value came from, e.g. "3DEP 1/3 arc-second seamless
   *  DEM". Distinct from fetchedAt: when the data was published, not when we
   *  read it. */
  datasetVintage?: string | null;
}

export interface ParcelFacts {
  address: string;
  coordinates: { lat: number; lng: number };
  wildfireFields: Record<string, CitedField>;
  floodFields: Record<string, CitedField>;
}

export interface FireHistoryCheck {
  nearestPerimeterDistanceMiles: number;
  nearestPerimeterYear: number;
  perimeterName: string;
  /** Provenance of the perimeter dataset this result was derived from. Carried
   *  on the result itself so a fire-history claim cannot reach the letter
   *  uncited, the same guarantee CitedField gives Mireye values. The canonical
   *  values live in lib/fire-source.ts: populate these from
   *  FIRE_PERIMETER_SOURCE rather than retyping the strings. */
  source: string;
  fetchedAt: string;
}

export interface ReconciliationResult {
  insurerStatedReason: string;
  /** False is a real, expected outcome: on some demo parcels the insurer is
   *  correct. The agent has to be able to say so.
   *
   *  Read this as the actionable bit: is there a basis to contest the decision
   *  as stated. It is not a claim that the insurer is wrong about everything. */
  mismatchFound: boolean;
  /** True when the honest answer runs both ways and a bare verdict would
   *  misrepresent it.
   *
   *  Orthogonal to mismatchFound, because either verdict can be two-sided.
   *  Oxnard: the flag is justified on the area's fire record while the parcel
   *  itself measures benign (mismatchFound false, partiallySupported true).
   *  Santa Monica: the insurer's twelve month claim is factually wrong but a
   *  megafire really did burn 1.4 miles away (mismatchFound true,
   *  partiallySupported true).
   *
   *  This exists because the agent kept producing two-sided conclusions that a
   *  boolean flattened into a wrong headline. A homeowner told "your insurer is
   *  wrong" who then discovers the area burned last year stops trusting the
   *  tool, and rightly. */
  partiallySupported?: boolean;
  explanation: string;
  supportingFacts: Array<{ claim: string; source: string; fetchedAt: string }>;
}

/** Request body for POST /api/appeal. */
export interface AppealRequest {
  /** Street address, or free text pasted from a non-renewal notice that the
   *  agent extracts the address and stated reason from. */
  address: string;
  insurerStatedReason: string;
}

/** Response body from POST /api/appeal. This is what the UI renders. */
export interface AppealResponse {
  parcel: ParcelFacts;
  fireHistory: FireHistoryCheck | null;
  reconciliation: ReconciliationResult;
  /** Rendered appeal letter. Null when no mismatch was found (nothing to
   *  appeal) or when citation checking withheld it, in which case
   *  letterWithheldReason says why. */
  letter: string | null;
  /** Why no letter was produced despite a mismatch. Null when a letter was
   *  generated, or when none was warranted. */
  letterWithheldReason?: string | null;
  /** False when the reconciliation's explanation failed verification and must
   *  not be displayed as a finding. The UI shows a neutral notice instead:
   *  presenting an unverified conclusion is the same failure as writing it into
   *  a letter, just in a different place on the page. */
  explanationTrusted?: boolean;
  /** Claims the agent made that failed citation checking and were dropped
   *  before rendering. Surfaced rather than hidden: a populated array means the
   *  reasoning step is inventing sources and needs fixing. */
  rejectedFacts?: Array<{ claim: string; source: string; reason: string }>;
  /** Field presets the agent decided to fetch. The claim that the agent picks
   *  its own evidence rather than fetching everything is checkable here. */
  presetsChosen?: string[];
  /** Ordered tool names the agent called, so its path is visible. */
  toolCalls?: string[];
  /** Fields that could not be retrieved. Shown rather than dropped: a missing
   *  slope reading is not a flat parcel. */
  unavailableFields?: string[];
}
