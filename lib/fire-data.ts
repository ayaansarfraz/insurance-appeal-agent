/**
 * Wildfire perimeter history queries.
 *
 * OWNER: Agent B. STUB — returns fixture data.
 *
 * Replace with turf.js queries against data/fire-perimeters.geojson.
 *
 * Trim the source dataset to California and roughly the last 20 years BEFORE
 * committing it. The full NIFC national perimeter set is hundreds of MB, which
 * would bloat the repo and the Vercel bundle. Raw .zip/.shp downloads are
 * gitignored; only the trimmed GeoJSON belongs in /data.
 */

import { fixtureFireHistory } from './fixtures';
import type { FireHistoryCheck } from './types';

/**
 * Nearest recorded fire perimeter to a parcel. Returns null when nothing is
 * within the search radius — which is itself evidence for an appeal, not an
 * error condition.
 */
export async function nearestFirePerimeter(
  coordinates: { lat: number; lng: number },
): Promise<FireHistoryCheck | null> {
  console.warn('[stub] fire-data.nearestFirePerimeter called for %o — returning fixture', coordinates);
  return fixtureFireHistory;
}
