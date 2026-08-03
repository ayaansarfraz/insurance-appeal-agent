/**
 * POST /api/appeal — runs the full pipeline: address + insurer reason in,
 * cited reconciliation and appeal letter out.
 *
 * OWNER: Agent A, exclusively. Agent B calls this endpoint but must not edit
 * this file. It currently wires the Phase 0 stubs together, so it already
 * returns a correctly shaped AppealResponse and the UI can be built against it
 * before any real integration exists.
 *
 * Runs server-side so MIREYE_API_KEY and ANTHROPIC_API_KEY never reach the
 * client.
 */

import { NextResponse } from 'next/server';

import { reconcile } from '@/lib/agent';
import { nearestFirePerimeter } from '@/lib/fire-data';
import { fetchParcelFields, geocode } from '@/lib/mireye';
import { renderAppealLetter } from '@/lib/letter-template';
import type { AppealRequest, AppealResponse } from '@/lib/types';

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

  // TODO(Agent A): the preset choice belongs to the agent, driven by the
  // insurer's stated reason, not hardcoded here. Lands on
  // feat/agent-reconciliation.
  const geocoded = await geocode(address);
  const coordinates = { lat: geocoded.lat, lng: geocoded.lng };
  const { parcel } = await fetchParcelFields(
    geocoded.normalizedAddress ?? address,
    coordinates,
    ['wildfire_underwrite'],
  );
  const fireHistory = await nearestFirePerimeter(coordinates);
  const reconciliation = await reconcile(parcel, fireHistory, insurerStatedReason);

  const response: AppealResponse = {
    parcel,
    fireHistory,
    reconciliation,
    letter: reconciliation.mismatchFound
      ? renderAppealLetter(parcel, fireHistory, reconciliation)
      : null,
  };

  return NextResponse.json(response);
}
