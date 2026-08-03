/**
 * POST /api/appeal — runs the full pipeline: address + insurer reason in,
 * cited reconciliation and appeal letter out.
 *
 * OWNER: Agent A, exclusively.
 *
 * The route no longer decides what to fetch. It hands the address and the
 * stated reason to the agent, which chooses its own evidence and returns both
 * the facts it gathered and the conclusion it drew. The route's remaining job
 * is to check that conclusion before publishing it.
 *
 * Runs server-side so MIREYE_API_KEY and ANTHROPIC_API_KEY never reach the
 * client.
 */

import { NextResponse } from 'next/server';

import { runAppealAgent } from '@/lib/agent';
import { auditCitations, isExplanationTrustworthy, mayGenerateLetter } from '@/lib/citation-guard';
import { renderAppealLetter } from '@/lib/letter-template';
import type { AppealRequest, AppealResponse, ReconciliationResult } from '@/lib/types';

/** The agent makes several sequential model calls with tool use in between, so
 *  this runs well past the default serverless timeout on Vercel. */
export const maxDuration = 300;

export async function POST(request: Request) {
  let body: AppealRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const { address, insurerStatedReason } = body;
  if (!address?.trim() || !insurerStatedReason?.trim()) {
    return NextResponse.json(
      { error: 'Both address and insurerStatedReason are required.' },
      { status: 400 },
    );
  }

  let run;
  try {
    run = await runAppealAgent(address.trim(), insurerStatedReason.trim());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'The assessment failed.';
    console.error('[appeal] agent run failed:', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { parcel, fireHistory, reconciliation, presetsChosen, toolCalls, unavailableFields } = run;

  // Every claim the agent produced is checked against the sources actually
  // fetched before any of it reaches a letter or a headline verdict. See
  // lib/citation-guard.ts for why this stays now that the agent is real.
  const audit = auditCitations(reconciliation, parcel, fireHistory);
  const checkedReconciliation: ReconciliationResult = {
    ...reconciliation,
    supportingFacts: audit.verifiedFacts,
  };

  let letter: string | null = null;
  let letterWithheldReason: string | null = null;

  if (checkedReconciliation.mismatchFound) {
    const verdict = mayGenerateLetter(reconciliation, audit);
    if (verdict.allowed) {
      letter = renderAppealLetter(parcel, fireHistory, checkedReconciliation);
    } else {
      letterWithheldReason = verdict.reason ?? 'Letter withheld by citation checking.';
    }
  }

  const response: AppealResponse = {
    parcel,
    fireHistory,
    reconciliation: checkedReconciliation,
    letter,
    letterWithheldReason,
    explanationTrusted: isExplanationTrustworthy(reconciliation),
    rejectedFacts: audit.rejectedFacts,
    presetsChosen,
    toolCalls,
    unavailableFields,
  };

  return NextResponse.json(response);
}
