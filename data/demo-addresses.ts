/**
 * Fixed demo address list.
 *
 * OWNER: Agent B. STUB — needs 5 to 10 real California addresses.
 *
 * The list must mix cases: some parcels where the insurer's wildfire flag is
 * genuinely justified and some where it is not, so the demo shows the agent
 * discriminating rather than always finding a mismatch. Decide the list early
 * and test against it consistently rather than letting it grow ad hoc.
 *
 * Agent A: treat this as read-only. If you want an address added, ask.
 */

export interface DemoAddress {
  address: string;
  /** Verbatim style of rationale an insurer would put in a non-renewal notice. */
  insurerStatedReason: string;
  /** What we expect the agent to conclude, used to sanity check the pipeline. */
  expectedMismatch: boolean;
  notes: string;
}

export const demoAddresses: DemoAddress[] = [
  // TODO(Agent B): replace with real addresses once perimeter data is loaded.
];
