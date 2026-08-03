/**
 * Provenance for the wildfire perimeter dataset.
 *
 * OWNER: Agent B. New file, safe to import anywhere.
 *
 * This lives apart from lib/fire-data.ts on purpose: fire-data.ts reads the
 * GeoJSON off disk with node:fs and can only ever run server side, but the UI
 * needs the citation text too. Keeping the provenance in a dependency-free
 * module lets the client render it without dragging fs into the browser
 * bundle.
 *
 * NOTE FOR AGENT A: FireHistoryCheck in the frozen contract carries no source
 * or fetchedAt of its own, so any supportingFact you build from fire history
 * should cite FIRE_PERIMETER_SOURCE.source and FIRE_PERIMETER_SOURCE.fetchedAt
 * verbatim. Import them from here rather than retyping the strings.
 */

export interface DatasetProvenance {
  /** Human readable citation, rendered next to any value derived from it. */
  source: string;
  sourceUrl: string;
  /** Date the committed extract was pulled, ISO yyyy-mm-dd. */
  fetchedAt: string;
  /** The filter applied before commit, so the coverage claim is auditable. */
  coverage: string;
  /** How much the geometry was generalized, and what that costs in accuracy. */
  precisionNote: string;
}

export const FIRE_PERIMETER_SOURCE: DatasetProvenance = {
  source: 'CAL FIRE FRAP, California Fire Perimeters (1950+), ArcGIS FeatureServer layer 2',
  sourceUrl:
    'https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/California_Historic_Fire_Perimeters/FeatureServer/2',
  fetchedAt: '2026-08-02',
  coverage: 'California perimeters, 2006 through 2025 (7,298 recorded fires)',
  precisionNote:
    'Perimeter geometry generalized to roughly 70 metres and reprojected to WGS84. ' +
    'Distances are reported to the nearest tenth of a mile, which is coarser than that error.',
};

/** Search radius for the nearest-perimeter query. Beyond this we report no
 *  recorded fire rather than a very distant one, since a fire 40 miles away is
 *  not evidence about this parcel either way. */
export const SEARCH_RADIUS_MILES = 25;

/** Earliest year in the committed extract. Used in letter copy so the coverage
 *  window is never overstated. */
export const COVERAGE_START_YEAR = 2006;
export const COVERAGE_END_YEAR = 2025;
