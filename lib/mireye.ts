/**
 * Mireye API client — geocode + parcel field fetch.
 *
 * OWNER: Agent A. Server side only. Never import from a client component:
 * MIREYE_API_KEY must not reach the browser.
 *
 * Verified against the live API on 2026-08-03. Two corrections to what the
 * Phase 0 stub assumed, both recorded in CLAUDE.md Lessons Learned:
 *
 *   1. The base URL is api.mireye.com, not api.mireye.ai (which does not
 *      resolve). The docs are hosted on docs.mireye.ai, hence the confusion.
 *   2. The wire format is snake_case (fetched_at, source_url) and carries more
 *      per-field metadata than the frozen contract modelled: unit,
 *      dataset_vintage, and a per-field status. This module is the translation
 *      boundary — everything above it sees the camelCase CitedField.
 *
 * Billing is per field per location, so callers pass only the presets the
 * insurer's stated reason actually implicates. The agent makes that choice;
 * see lib/agent.ts.
 */

import type { CitedField, ParcelFacts } from './types';

const MIREYE_BASE_URL = 'https://api.mireye.com';

/** Presets this project fetches. The full catalog is larger; these are the
 *  three that bear on a wildfire or flood non-renewal.
 *
 *  natural_hazard matters more than its name suggests: it carries
 *  wildfire_annual_frequency, the FEMA National Risk Index annualized figure
 *  for the containing census TRACT. That is the same class of coarse,
 *  aggregated model an insurer typically cites, so fetching it lets the agent
 *  compare the tract-level model against the parcel-level measurements
 *  directly rather than arguing against an unstated number. */
export type MireyePreset = 'wildfire_underwrite' | 'flood_risk' | 'natural_hazard';

/** Field names in the flood_risk preset, per GET /v1/meta/fields at catalog
 *  version 0.14.0. Used to route natural_hazard's mixed output into the right
 *  half of ParcelFacts: that preset spans wildfire, flood, seismic and wind, so
 *  routing by preset rather than by field would misfile within_floodplain_polygon
 *  as a wildfire fact. Anything not listed here is treated as wildfire-side,
 *  which is correct for this demo's scope. */
const FLOOD_FIELD_NAMES = new Set([
  'coast_distance_m',
  'intersects_nhd_area',
  'nearest_waterbody_name',
  'within_floodplain_polygon',
  'intersects_wetland',
  'wetland_type',
  'wetland_subtype',
  'wetland_acres',
  'nearest_wetland_distance_m',
  'wetlands_within_100m_count',
  'wetlands_within_500m_count',
  'surface_water_permanence_pct',
  'nearest_dam_distance_m',
  'nearest_dam_hazard_potential',
  'high_hazard_dams_within_10km',
]);

/** elevation appears in both presets. It reads as a flood fact (height above
 *  the vertical datum) far more often than a wildfire one, but only when flood
 *  is actually at issue, so it is routed dynamically rather than listed above. */
const DUAL_USE_FIELD_NAMES = new Set(['elevation', 'slope_degrees']);

// -- wire types -------------------------------------------------------------
// Shapes returned by the API, snake_case exactly as received. Kept separate
// from the app-facing types so a change on either side is a compile error here
// rather than a silent mismatch downstream.

interface WireGeocodeResponse {
  lat: number;
  lng: number;
  accuracy: number | null;
  accuracy_type: string;
  match_type: string | null;
  normalized_address: string | null;
  provider: string;
  source: string | null;
}

interface WireField {
  value: unknown;
  unit: string | null;
  source: string;
  source_url: string | null;
  confidence: string;
  fetched_at: string;
  dataset_vintage: string | null;
  ttl_seconds: number | null;
  notes: string | null;
  /** "ok" on success. Anything else means the value is not trustworthy and the
   *  field is dropped rather than cited. */
  status: string;
}

interface WireFetchResponse {
  lat: number;
  lng: number;
  fetched_at: string;
  fields: Record<string, WireField>;
  /** Fields the API could not retrieve. Never empty-checked away: a field we
   *  failed to fetch must not silently read as a field with no risk. */
  partial_failures: Array<{ field?: string; reason?: string } | string>;
  resolved_location: { lat: number; lng: number; source: string };
}

/** Geocode result, including the provenance of the match itself. An appeal
 *  turns on which parcel was measured, so how the address resolved is a
 *  citable fact in its own right. */
export interface GeocodeResult {
  lat: number;
  lng: number;
  normalizedAddress: string | null;
  accuracy: number | null;
  accuracyType: string;
  provider: string;
  source: string | null;
}

function apiKey(): string {
  const key = process.env.MIREYE_API_KEY;
  if (!key) {
    throw new Error(
      'MIREYE_API_KEY is not set. Copy .env.example to .env.local and fill it in. ' +
        'Note that .env.local does not carry across git worktrees.',
    );
  }
  return key;
}

async function post<T>(path: string, body: unknown, timeoutMs = 60_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${MIREYE_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Mireye ${path} failed: ${response.status} ${response.statusText}${
          detail ? ` — ${detail.slice(0, 400)}` : ''
        }`,
      );
    }
    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Mireye ${path} timed out after ${timeoutMs}ms.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** POST /v1/geocode — 1 credit. */
export async function geocode(address: string): Promise<GeocodeResult> {
  const trimmed = address.trim();
  if (!trimmed) throw new Error('geocode requires a non-empty address.');

  const wire = await post<WireGeocodeResponse>('/v1/geocode', { address: trimmed });
  return {
    lat: wire.lat,
    lng: wire.lng,
    normalizedAddress: wire.normalized_address,
    accuracy: wire.accuracy,
    accuracyType: wire.accuracy_type,
    provider: wire.provider,
    source: wire.source,
  };
}

function toCitedField(wire: WireField): CitedField {
  return {
    value: wire.value,
    source: wire.source,
    fetchedAt: wire.fetched_at,
    confidence: wire.confidence,
    unit: wire.unit,
    sourceUrl: wire.source_url,
    datasetVintage: wire.dataset_vintage,
  };
}

/**
 * POST /v1/fetch — 1 credit per field per location.
 *
 * One request per preset, run concurrently. Fields whose status is not "ok"
 * are dropped: a value we could not verify has no place in a letter whose
 * entire claim is that every statement is sourced.
 *
 * Returns the dropped field names alongside the facts so the caller can say
 * what was unavailable instead of treating an absent measurement as a benign
 * one. A missing slope reading is not a flat parcel.
 */
export async function fetchParcelFields(
  address: string,
  coordinates: { lat: number; lng: number },
  presets: MireyePreset[],
): Promise<{ parcel: ParcelFacts; unavailableFields: string[] }> {
  if (presets.length === 0) {
    throw new Error('fetchParcelFields requires at least one preset.');
  }

  const responses = await Promise.all(
    Array.from(new Set(presets)).map((preset) =>
      post<WireFetchResponse>('/v1/fetch', {
        lat: coordinates.lat,
        lng: coordinates.lng,
        preset,
      }),
    ),
  );

  const wildfireFields: Record<string, CitedField> = {};
  const floodFields: Record<string, CitedField> = {};
  const unavailableFields: string[] = [];
  const floodRequested = presets.includes('flood_risk');

  for (const response of responses) {
    for (const [name, field] of Object.entries(response.fields)) {
      if (field.status !== 'ok') {
        unavailableFields.push(name);
        continue;
      }
      const isFlood =
        FLOOD_FIELD_NAMES.has(name) || (floodRequested && DUAL_USE_FIELD_NAMES.has(name));
      (isFlood ? floodFields : wildfireFields)[name] = toCitedField(field);
    }

    for (const failure of response.partial_failures) {
      const name = typeof failure === 'string' ? failure : (failure.field ?? 'unknown field');
      unavailableFields.push(name);
    }
  }

  return {
    parcel: { address, coordinates, wildfireFields, floodFields },
    unavailableFields: Array.from(new Set(unavailableFields)),
  };
}
