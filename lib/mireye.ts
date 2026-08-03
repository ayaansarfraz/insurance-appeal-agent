/**
 * Mireye API client — geocode + parcel field fetch.
 *
 * OWNER: Agent A. STUB — returns fixture data.
 *
 * FIRST TASK BEFORE ANY OTHER WORK: make one real /v1/geocode call and one
 * real /v1/fetch call, and paste the raw JSON responses into the Lessons
 * Learned section of CLAUDE.md. The CitedField shape in lib/types.ts assumes
 * every field comes back as { value, source, fetchedAt, confidence } and that
 * is UNVERIFIED. If the real shape differs, types.ts has to change on main and
 * both branches rebase — much cheaper to discover on day one.
 *
 * Docs: https://docs.mireye.ai
 */

import { fixtureParcelFacts } from './fixtures';
import type { ParcelFacts } from './types';

const MIREYE_BASE_URL = 'https://api.mireye.ai';

function apiKey(): string {
  const key = process.env.MIREYE_API_KEY;
  if (!key) throw new Error('MIREYE_API_KEY is not set. Copy .env.example to .env.local.');
  return key;
}

/** POST /v1/geocode — 1 credit. */
export async function geocode(address: string): Promise<{ lat: number; lng: number }> {
  void apiKey;
  void MIREYE_BASE_URL;
  console.warn('[stub] mireye.geocode called for %s — returning fixture coordinates', address);
  return fixtureParcelFacts.coordinates;
}

/**
 * POST /v1/fetch — 1 credit per field per location, so the agent should pass
 * only the presets the insurer's stated reason actually implicates rather than
 * requesting everything.
 */
export async function fetchParcelFields(
  address: string,
  coordinates: { lat: number; lng: number },
  presets: Array<'wildfire_underwrite' | 'flood_risk'>,
): Promise<ParcelFacts> {
  console.warn('[stub] mireye.fetchParcelFields called with presets %o — returning fixture facts', presets);
  return { ...fixtureParcelFacts, address, coordinates };
}
