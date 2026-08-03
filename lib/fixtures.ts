/**
 * Fixture data backing the Phase 0 stubs.
 *
 * These exist so both work streams can build in parallel without blocking on
 * each other: Agent B's UI has a correctly shaped endpoint to render from
 * before the Mireye pipeline exists, and Agent A's reconciler has a
 * FireHistoryCheck to reason about before the perimeter data is loaded.
 *
 * Delete a fixture when the real implementation that replaces it lands.
 */

import type { FireHistoryCheck, ParcelFacts, ReconciliationResult } from './types';

const FETCHED_AT = '2026-08-02T00:00:00Z';

export const fixtureParcelFacts: ParcelFacts = {
  address: '1200 Fake Canyon Rd, Santa Rosa, CA 95404',
  coordinates: { lat: 38.4405, lng: -122.7144 },
  wildfireFields: {
    slopePercent: {
      value: 4.2,
      source: 'FIXTURE — USGS 3DEP (placeholder)',
      fetchedAt: FETCHED_AT,
      confidence: 'high',
    },
    distanceToWildlandUrbanInterfaceMiles: {
      value: 3.8,
      source: 'FIXTURE — USFS WUI (placeholder)',
      fetchedAt: FETCHED_AT,
      confidence: 'high',
    },
    defensibleSpaceMeters: {
      value: 46,
      source: 'FIXTURE — placeholder',
      fetchedAt: FETCHED_AT,
      confidence: 'medium',
    },
  },
  floodFields: {},
};

export const fixtureFireHistory: FireHistoryCheck = {
  nearestPerimeterDistanceMiles: 7.3,
  nearestPerimeterYear: 2017,
  perimeterName: 'FIXTURE — Tubbs Fire (placeholder)',
};

export const fixtureReconciliation: ReconciliationResult = {
  insurerStatedReason:
    'Property located in a high wildfire risk zone per our catastrophe model.',
  mismatchFound: true,
  explanation:
    'FIXTURE RESULT — not produced by the agent. The insurer cites zone-level ' +
    'wildfire risk, but parcel-level data shows low slope, defensible space ' +
    'well beyond the 30m standard, and no fire perimeter within 7 miles in ' +
    'the last 9 years.',
  supportingFacts: [
    {
      claim: 'Parcel slope is 4.2 percent, well below the threshold associated with rapid fire spread.',
      source: 'FIXTURE — USGS 3DEP (placeholder)',
      fetchedAt: FETCHED_AT,
    },
    {
      claim: 'Nearest recorded fire perimeter is 7.3 miles away and dates to 2017.',
      source: 'FIXTURE — NIFC perimeter history (placeholder)',
      fetchedAt: FETCHED_AT,
    },
  ],
};
