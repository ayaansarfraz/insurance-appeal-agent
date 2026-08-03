/**
 * The reconciliation core: Claude tool-calling loop.
 *
 * OWNER: Agent A. STUB — returns fixture data.
 *
 * This is the part of the project that is actually the product. Everything
 * else is plumbing. Two properties matter:
 *
 * 1. The agent CHOOSES its fetches. Given "high wildfire risk zone" it should
 *    request the wildfire_underwrite preset and not the 13 flood_risk fields.
 *    That is what makes this agentic rather than a fixed script, and fields
 *    are billed per field per location so it is also cost control.
 * 2. The agent must be able to conclude mismatchFound: false. On some demo
 *    parcels the insurer is right, and a reconciler that always finds a
 *    mismatch is a letter generator, not a reasoner.
 *
 * Expose mireye.geocode and mireye.fetchParcelFields as tools on the Messages
 * API, plus the fire-history lookup, and let the model drive.
 */

import { fixtureReconciliation } from './fixtures';
import type { FireHistoryCheck, ParcelFacts, ReconciliationResult } from './types';

export async function reconcile(
  parcel: ParcelFacts,
  fireHistory: FireHistoryCheck | null,
  insurerStatedReason: string,
): Promise<ReconciliationResult> {
  console.warn('[stub] agent.reconcile called — returning fixture reconciliation');
  return { ...fixtureReconciliation, insurerStatedReason };
}
