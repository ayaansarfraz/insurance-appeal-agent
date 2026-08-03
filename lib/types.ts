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
}

export interface ReconciliationResult {
  insurerStatedReason: string;
  /** False is a real, expected outcome: on some demo parcels the insurer is
   *  correct. The agent has to be able to say so. */
  mismatchFound: boolean;
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
  /** Rendered appeal letter. Null when no mismatch was found, since there is
   *  nothing to appeal. */
  letter: string | null;
}
