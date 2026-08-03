/**
 * Appeal letter generation.
 *
 * OWNER: Agent B.
 *
 * AUDIENCE DECISION: this letter is addressed to the INSURER, as a formal
 * request for reconsideration to their underwriting department. It is not a
 * California Department of Insurance complaint.
 *
 * Why the insurer and not the DOI: a DOI Request for Assistance normally
 * expects the policyholder to have raised the issue with the carrier first and
 * to attach the carrier's response, so the insurer letter is the document that
 * actually has to exist first. It is also the one with leverage, since the
 * carrier can simply reverse the decision, whereas the DOI can only review it.
 * The two documents want different things: the insurer letter argues
 * underwriting facts and asks for reinstatement, while a DOI complaint argues
 * that the carrier's conduct was improper and asks a regulator to intervene.
 * Trying to serve both produces a letter that does neither job well.
 *
 * The DOI complaint is the natural follow-on. The closing section below tells
 * the homeowner exactly that, and the letter is structured so its findings
 * table can be attached to a Request for Assistance unchanged.
 *
 * Conventions enforced here:
 *   - No em dashes anywhere in the output.
 *   - Every factual claim carries its source and fetch date inline, at the
 *     point of the claim, not in a footnote. A claim that loses its citation on
 *     the way to the page is worse than a claim that was never made.
 */

import {
  COVERAGE_END_YEAR,
  COVERAGE_START_YEAR,
  FIRE_PERIMETER_SOURCE,
  SEARCH_RADIUS_MILES,
} from './fire-source';
import type { CitedField, FireHistoryCheck, ParcelFacts, ReconciliationResult } from './types';

/** camelCase or snake_case field keys into something a claims adjuster reads. */
function humanizeFieldName(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/** Mireye field values are typed unknown in the frozen contract, so render
 *  defensively rather than assuming a shape. */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'not reported';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  }
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(formatValue).join(', ');
  return JSON.stringify(value);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function citation(source: string, fetchedAt: string): string {
  return `[Source: ${source}. Retrieved ${formatDate(fetchedAt)}.]`;
}

function fieldLine(key: string, field: CitedField): string {
  const confidence = field.confidence ? ` Reported confidence: ${field.confidence}.` : '';
  return `  ${humanizeFieldName(key)}: ${formatValue(field.value)}. ${citation(field.source, field.fetchedAt)}${confidence}`;
}

/** Plain sentence describing the nearest perimeter result, including the null
 *  case, which is the strongest evidence an appeal can carry. */
function fireHistorySentence(fireHistory: FireHistoryCheck | null): string {
  if (!fireHistory) {
    return (
      `No recorded wildfire perimeter falls within ${SEARCH_RADIUS_MILES} miles of this parcel ` +
      `for the period ${COVERAGE_START_YEAR} through ${COVERAGE_END_YEAR}.`
    );
  }
  if (fireHistory.nearestPerimeterDistanceMiles === 0) {
    return (
      `This parcel falls inside the recorded perimeter of the ${fireHistory.perimeterName} ` +
      `of ${fireHistory.nearestPerimeterYear}.`
    );
  }
  return (
    `The nearest recorded wildfire perimeter is the ${fireHistory.perimeterName} of ` +
    `${fireHistory.nearestPerimeterYear}, measured at ${fireHistory.nearestPerimeterDistanceMiles} ` +
    `miles from the parcel boundary.`
  );
}

function today(): string {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Renders the appeal. Returns plain text so it can be copied straight into an
 * email, printed, or attached to a regulator filing without reformatting.
 */
export function renderAppealLetter(
  parcel: ParcelFacts,
  fireHistory: FireHistoryCheck | null,
  reconciliation: ReconciliationResult,
): string {
  const wildfireEntries = Object.entries(parcel.wildfireFields ?? {});
  const floodEntries = Object.entries(parcel.floodFields ?? {});

  const lines: string[] = [];
  const push = (...l: string[]) => lines.push(...l);

  // ---- Heading block -------------------------------------------------
  push(
    today(),
    '',
    '[Your full name]',
    parcel.address,
    '[Your phone number]',
    '[Your email address]',
    '',
    'Underwriting Department, Attention: Appeals and Reconsideration',
    '[Insurer name]',
    '[Insurer address]',
    '',
    `RE: Request for reconsideration of non-renewal or premium adjustment`,
    `    Policy number: [Policy number]`,
    `    Insured property: ${parcel.address}`,
    `    Parcel coordinates of record: ${parcel.coordinates.lat.toFixed(5)}, ${parcel.coordinates.lng.toFixed(5)}`,
    '',
    'To the Underwriting Department:',
    '',
  );

  // ---- 1. Purpose ----------------------------------------------------
  push(
    'I am writing to formally request reconsideration of your decision regarding the policy',
    'referenced above. The decision was justified on wildfire risk grounds. This letter sets out',
    'parcel level physical evidence and recorded wildfire history for this specific property, and',
    'asks you to review that evidence against the rationale you provided.',
    '',
    'Every factual statement below carries its data source and the date that data was retrieved,',
    'at the point the statement is made. Nothing here is estimated or inferred by me.',
    '',
  );

  // ---- 2. The stated reason -------------------------------------------
  push(
    '1. THE REASON GIVEN',
    '',
    'The rationale provided was, in substance:',
    '',
    `    "${reconciliation.insurerStatedReason.trim()}"`,
    '',
    'That rationale is addressed point by point below.',
    '',
  );

  // ---- 3. Parcel level findings ---------------------------------------
  push('2. PARCEL LEVEL PHYSICAL FINDINGS FOR THIS PROPERTY', '');

  if (wildfireEntries.length === 0 && floodEntries.length === 0) {
    push(
      '  No parcel level physical measurements were available at the time of writing.',
      '',
    );
  } else {
    if (wildfireEntries.length > 0) {
      push('Wildfire relevant measurements:', '');
      for (const [key, field] of wildfireEntries) push(fieldLine(key, field));
      push('');
    }
    if (floodEntries.length > 0) {
      push('Flood relevant measurements:', '');
      for (const [key, field] of floodEntries) push(fieldLine(key, field));
      push('');
    }
    push(
      'These are measurements of this parcel, not of the ZIP code, census tract, or rating',
      'territory it sits within. Where a model output and a parcel measurement disagree, the',
      'parcel measurement is the more specific evidence.',
      '',
    );
  }

  // ---- 4. Recorded wildfire history -----------------------------------
  push(
    '3. RECORDED WILDFIRE HISTORY NEAR THIS PARCEL',
    '',
    `  ${fireHistorySentence(fireHistory)}`,
    `  ${citation(FIRE_PERIMETER_SOURCE.source, FIRE_PERIMETER_SOURCE.fetchedAt)}`,
    '',
    `  Coverage of that dataset: ${FIRE_PERIMETER_SOURCE.coverage}.`,
    `  Search radius applied: ${SEARCH_RADIUS_MILES} miles from the parcel.`,
    `  Method: distance measured from the parcel coordinates to the nearest point on each`,
    `  recorded perimeter, in WGS84, using the full perimeter geometry rather than a fire's`,
    `  centre point or its county of record. ${FIRE_PERIMETER_SOURCE.precisionNote}`,
    `  Dataset available for independent verification at ${FIRE_PERIMETER_SOURCE.sourceUrl}`,
    '',
  );

  // ---- 5. The argument -------------------------------------------------
  push('4. WHY THE STATED REASON IS NOT SUPPORTED FOR THIS PROPERTY', '');
  for (const paragraph of reconciliation.explanation.split(/\n{2,}/)) {
    const text = paragraph.trim();
    if (text) push(text, '');
  }

  if (reconciliation.supportingFacts.length > 0) {
    push('The specific findings this conclusion rests on:', '');
    reconciliation.supportingFacts.forEach((fact, i) => {
      push(`  ${i + 1}. ${fact.claim.trim()}`);
      push(`     ${citation(fact.source, fact.fetchedAt)}`);
    });
    push('');
  }

  // ---- 6. Relief requested ---------------------------------------------
  push(
    '5. WHAT I AM ASKING FOR',
    '',
    '  a. That the wildfire risk determination for this property be reviewed against the',
    '     parcel level evidence above rather than against zone, ZIP code, or territory level',
    '     model output alone.',
    '  b. That you identify, in writing, which specific characteristics of this parcel drove',
    '     the determination, and the vintage of the data those characteristics were drawn from.',
    '  c. That the non-renewal or premium adjustment be withdrawn or revised if the parcel',
    '     level evidence does not support it.',
    '  d. That any mitigation already present at this property, including the measurements',
    '     listed in section 2, be credited under your applicable wildfire mitigation discount',
    '     programme.',
    '',
  );

  // ---- 7. Closing -------------------------------------------------------
  push(
    '6. RESPONSE',
    '',
    'Please respond in writing within 30 days of the date of this letter. If your determination',
    'is unchanged, please state the specific parcel level data relied on, so that the',
    'disagreement is a factual one on the record rather than a difference of opinion about a',
    'model output.',
    '',
    'If this matter is not resolved directly, I intend to file a Request for Assistance with the',
    'California Department of Insurance and to attach this letter, the findings in sections 2 and',
    '3, and your response to it.',
    '',
    'Thank you for reviewing this.',
    '',
    'Sincerely,',
    '',
    '',
    '[Your signature]',
    '[Your full name]',
    '',
  );

  // ---- 8. Sources -------------------------------------------------------
  push('APPENDIX: SOURCES CITED', '');
  const seen = new Set<string>();
  const addSource = (source: string, fetchedAt: string) => {
    const key = `${source}|${fetchedAt}`;
    if (seen.has(key)) return;
    seen.add(key);
    push(`  - ${source}. Retrieved ${formatDate(fetchedAt)}.`);
  };
  for (const [, field] of [...wildfireEntries, ...floodEntries]) {
    addSource(field.source, field.fetchedAt);
  }
  for (const fact of reconciliation.supportingFacts) addSource(fact.source, fact.fetchedAt);
  addSource(FIRE_PERIMETER_SOURCE.source, FIRE_PERIMETER_SOURCE.fetchedAt);
  push(
    '',
    'This letter was prepared with an automated tool that retrieves parcel level data and',
    'recorded wildfire perimeter history and compares them against a stated underwriting',
    'rationale. The underlying data is public and cited above so that every statement can be',
    'checked independently. It is not legal advice.',
  );

  return lines.join('\n');
}
