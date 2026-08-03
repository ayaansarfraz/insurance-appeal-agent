/**
 * Appeal letter generation.
 *
 * OWNER: Agent B. STUB — returns placeholder text.
 *
 * Should read like something a homeowner could actually file: formal tone,
 * every factual claim carrying its source and fetch date. No em dashes.
 *
 * OPEN QUESTION before writing this for real: the spec describes the output as
 * filable both with the insurer and with the state Department of Insurance.
 * Those are different documents with different audiences. Pick one for the
 * demo and note the other as the follow-on.
 */

import type { FireHistoryCheck, ParcelFacts, ReconciliationResult } from './types';

export function renderAppealLetter(
  parcel: ParcelFacts,
  fireHistory: FireHistoryCheck | null,
  reconciliation: ReconciliationResult,
): string {
  console.warn('[stub] letter-template.renderAppealLetter called — returning placeholder');

  const facts = reconciliation.supportingFacts
    .map((f) => `  - ${f.claim} [${f.source}, retrieved ${f.fetchedAt}]`)
    .join('\n');

  return [
    'PLACEHOLDER APPEAL LETTER (stub output, not the real template)',
    '',
    `Property: ${parcel.address}`,
    `Insurer stated reason: ${reconciliation.insurerStatedReason}`,
    '',
    reconciliation.explanation,
    '',
    'Supporting parcel-level findings:',
    facts,
  ].join('\n');
}
