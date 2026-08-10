/**
 * Refuses to let an uncited or fabricated claim reach the appeal letter.
 *
 * The entire premise of this product is that every statement in the letter
 * traces to a source someone else can re-fetch. A claim that cites a source we
 * never actually read is worse than no letter at all: it is a document a
 * homeowner would file with their insurer, or attach to a Department of
 * Insurance complaint, under their own signature.
 *
 * This is not a stub workaround. It stays after lib/agent.ts is real, because
 * the failure it catches is one a language model produces naturally: writing a
 * plausible supporting fact and attaching a plausible-looking citation to it.
 * The model proposes; this module checks the citation against the sources
 * actually returned by Mireye and the perimeter dataset, and drops anything
 * that does not match.
 *
 * Caught in testing on 2026-08-03: the pipeline produced a letter for a parcel
 * inside the 2018 Camp Fire perimeter that stated in section 3 that the parcel
 * had burned and in section 4 that the nearest fire was 7.3 miles away, citing
 * a source that did not exist. See CLAUDE.md Lessons Learned.
 */

import { FIRE_PERIMETER_SOURCE } from './fire-source';
import type { FireHistoryCheck, ParcelFacts, ReconciliationResult } from './types';

export interface CitationAudit {
  /** Facts whose source matches something we actually fetched. */
  verifiedFacts: ReconciliationResult['supportingFacts'];
  /** Facts dropped, with the reason. Surfaced to the caller rather than
   *  swallowed: silently discarding a claim hides a broken reconciler. */
  rejectedFacts: Array<{ claim: string; source: string; reason: string }>;
  /** True when nothing was rejected. */
  clean: boolean;
}

/** Sources legitimately available to cite for this parcel. */
function legitimateSources(
  parcel: ParcelFacts,
  fireHistory: FireHistoryCheck | null,
): Set<string> {
  const sources = new Set<string>();
  for (const field of Object.values(parcel.wildfireFields)) sources.add(field.source);
  for (const field of Object.values(parcel.floodFields)) sources.add(field.source);
  sources.add(FIRE_PERIMETER_SOURCE.source);
  if (fireHistory) sources.add(fireHistory.source);
  return sources;
}

/** Markers that a value came from Phase 0 fixture data rather than a live
 *  fetch. Belt and braces alongside the source check: a fixture that happened
 *  to reuse a real source string would otherwise pass. */
const FIXTURE_MARKERS = ['FIXTURE', 'placeholder'];

function looksLikeFixture(text: string): boolean {
  const haystack = text.toLowerCase();
  return FIXTURE_MARKERS.some((marker) => haystack.includes(marker.toLowerCase()));
}

/**
 * Checks each supporting fact's citation against the sources actually fetched.
 *
 * A fact survives only if its `source` exactly matches one we read for this
 * parcel and neither the claim nor the citation carries fixture markers.
 * Exact matching is deliberate: fuzzy matching would let "USGS 3DEP (estimated)"
 * pass as "USGS_3DEP_COG", and the difference between those two strings is the
 * difference between a verifiable claim and an unverifiable one.
 */
export function auditCitations(
  reconciliation: ReconciliationResult,
  parcel: ParcelFacts,
  fireHistory: FireHistoryCheck | null,
): CitationAudit {
  const legitimate = legitimateSources(parcel, fireHistory);
  const verifiedFacts: ReconciliationResult['supportingFacts'] = [];
  const rejectedFacts: CitationAudit['rejectedFacts'] = [];

  for (const fact of reconciliation.supportingFacts) {
    if (looksLikeFixture(fact.source) || looksLikeFixture(fact.claim)) {
      rejectedFacts.push({
        claim: fact.claim,
        source: fact.source,
        reason: 'carries fixture or placeholder text, so it did not come from a live fetch',
      });
      continue;
    }
    if (!legitimate.has(fact.source)) {
      rejectedFacts.push({
        claim: fact.claim,
        source: fact.source,
        reason: `cites "${fact.source}", which is not among the sources fetched for this parcel`,
      });
      continue;
    }
    verifiedFacts.push(fact);
  }

  return { verifiedFacts, rejectedFacts, clean: rejectedFacts.length === 0 };
}

/**
 * Whether a letter may be generated at all.
 *
 * Two independent bars. The explanation is prose the model wrote, so it is
 * checked for fixture markers directly rather than by citation. And a letter
 * with no verified supporting facts is an assertion with nothing behind it,
 * which is precisely the kind of document this project argues against.
 */
/**
 * Whether the reconciliation's prose explanation may be shown as a finding.
 *
 * Separate from the letter check because the two failed independently: the
 * first version of this guard blocked the letter but left the UI's verdict
 * banner rendering the same unverified explanation in the most prominent
 * position on the page. For a Paradise parcel that read "the stated reason is
 * not supported by this parcel" directly above a card showing the parcel is
 * inside the 2018 Camp Fire perimeter. Blocking the document is not enough if
 * the conclusion is still displayed.
 */
/** Tool-call XML leaked into prose (seen when the model writes parameters into
 *  explanation instead of structured fields). Same class of failure as a
 *  fixture: not a finding a homeowner should read. */
function looksLikeToolMarkup(text: string): boolean {
  return /<\/?(?:parameter|invoke)\b/i.test(text);
}

export function isExplanationTrustworthy(reconciliation: ReconciliationResult): boolean {
  return (
    !looksLikeFixture(reconciliation.explanation) &&
    !looksLikeToolMarkup(reconciliation.explanation)
  );
}

export function mayGenerateLetter(
  reconciliation: ReconciliationResult,
  audit: CitationAudit,
): { allowed: boolean; reason?: string } {
  if (looksLikeFixture(reconciliation.explanation)) {
    return {
      allowed: false,
      reason:
        'The reconciliation explanation still contains fixture text, so the reasoning step ' +
        'has not run against live data yet. Refusing to generate a letter from it.',
    };
  }
  if (looksLikeToolMarkup(reconciliation.explanation)) {
    return {
      allowed: false,
      reason:
        'The reconciliation explanation contains leaked tool-call markup, so it is not clean ' +
        'prose a homeowner should file. Refusing to generate a letter from it.',
    };
  }
  if (audit.verifiedFacts.length === 0) {
    return {
      allowed: false,
      reason:
        'No supporting fact survived citation checking, so there is nothing sourced to put ' +
        'in a letter. Generating one anyway would produce exactly the kind of unsupported ' +
        'assertion this tool exists to challenge.',
    };
  }
  return { allowed: true };
}
