/**
 * Rebuilds data/fire-perimeters.geojson from CAL FIRE's public FRAP service.
 *
 * OWNER: Agent B. Run with `node scripts/build-fire-perimeters.mjs`.
 *
 * Why this exists: the committed GeoJSON is a derived artifact, and every claim
 * the appeal letter makes about fire history rests on it. This script is the
 * provenance record: it shows exactly which layer, which filter, which
 * projection, and how much the geometry was generalized.
 *
 * Two things that will silently produce wrong answers if changed carelessly:
 *
 * 1. PROJECTION. The source layer is EPSG:3857 (Web Mercator, units = metres).
 *    turf.js assumes WGS84 degrees. We pass outSR=4326 so ArcGIS reprojects
 *    before we ever see the coordinates. Drop that parameter and every distance
 *    turf computes is garbage without erroring.
 * 2. SIMPLIFICATION. maxAllowableOffset (server side) and the local
 *    Douglas-Peucker pass both move perimeter vertices. Keep the combined error
 *    well under the 0.1 mile precision the letter reports distances at.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import simplify from '@turf/simplify';

const LAYER =
  'https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/California_Historic_Fire_Perimeters/FeatureServer/2';
const SOURCE_NAME = 'CAL FIRE FRAP, California Fire Perimeters (1950+)';

/** California only, roughly the last 20 years. The full national NIFC set is
 *  hundreds of MB and would blow the Vercel bundle limit. */
const WHERE = "STATE = 'CA' AND YEAR_ >= 2006";
const PAGE = 500;

/** Server-side generalization, in outSR units (degrees). ~33 m. */
const SERVER_OFFSET = 0.0003;
/** Local Douglas-Peucker tolerance, degrees. ~67 m. */
const LOCAL_TOLERANCE = 0.0006;
/** Coordinate decimals kept. 4 decimals is ~11 m at this latitude. */
const PRECISION = 4;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'fire-perimeters.geojson');

async function fetchAll() {
  const features = [];
  for (let offset = 0; ; offset += PAGE) {
    const params = new URLSearchParams({
      where: WHERE,
      outFields: 'YEAR_,FIRE_NAME,GIS_ACRES,ALARM_DATE',
      returnGeometry: 'true',
      outSR: '4326', // see PROJECTION note above
      geometryPrecision: '5',
      maxAllowableOffset: String(SERVER_OFFSET),
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
      orderByFields: 'OBJECTID',
      f: 'geojson',
    });
    const res = await fetch(`${LAYER}/query?${params}`);
    if (!res.ok) throw new Error(`ArcGIS ${res.status} at offset ${offset}`);
    const body = await res.json();
    if (body.error) throw new Error(JSON.stringify(body.error));
    const batch = body.features ?? [];
    features.push(...batch);
    process.stderr.write(`  fetched ${features.length}\r`);
    if (batch.length < PAGE) break;
  }
  process.stderr.write('\n');
  return features;
}

const scale = 10 ** PRECISION;
const round = (n) => Math.round(n * scale) / scale;

function roundRing(ring) {
  const out = [];
  for (const [x, y] of ring) {
    const rx = round(x);
    const ry = round(y);
    const last = out[out.length - 1];
    if (last && last[0] === rx && last[1] === ry) continue;
    out.push([rx, ry]);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length && (first[0] !== last[0] || first[1] !== last[1])) out.push([first[0], first[1]]);
  return out.length >= 4 ? out : null;
}

function cleanGeometry(g) {
  if (!g) return null;
  if (g.type === 'Polygon') {
    const rings = g.coordinates.map(roundRing).filter(Boolean);
    return rings.length ? { type: 'Polygon', coordinates: rings } : null;
  }
  if (g.type === 'MultiPolygon') {
    const polys = g.coordinates
      .map((poly) => poly.map(roundRing).filter(Boolean))
      .filter((poly) => poly.length);
    return polys.length ? { type: 'MultiPolygon', coordinates: polys } : null;
  }
  return null;
}

function bboxOf(g) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const walk = (ring) => {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  };
  if (g.type === 'Polygon') g.coordinates.forEach(walk);
  else g.coordinates.forEach((poly) => poly.forEach(walk));
  return [round(minX), round(minY), round(maxX), round(maxY)];
}

function isoDate(ms) {
  if (ms === null || ms === undefined) return null;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function titleCase(s) {
  if (!s) return null;
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).trim();
}

async function main() {
  console.log(`Fetching ${SOURCE_NAME} where ${WHERE}`);
  const raw = await fetchAll();

  const features = [];
  let dropped = 0;
  for (const f of raw) {
    if (!f.geometry) {
      dropped += 1;
      continue;
    }
    let geometry;
    try {
      geometry = simplify(
        { type: 'Feature', geometry: f.geometry, properties: {} },
        { tolerance: LOCAL_TOLERANCE, highQuality: false, mutate: true },
      ).geometry;
    } catch {
      geometry = f.geometry; // simplify can reject degenerate rings; keep the original
    }
    geometry = cleanGeometry(geometry);
    if (!geometry) {
      dropped += 1;
      continue;
    }

    const p = f.properties ?? {};
    features.push({
      type: 'Feature',
      properties: {
        name: titleCase(p.FIRE_NAME) || 'Unnamed fire',
        year: p.YEAR_ ?? null,
        acres: p.GIS_ACRES == null ? null : Math.round(p.GIS_ACRES * 10) / 10,
        alarmDate: isoDate(p.ALARM_DATE),
      },
      bbox: bboxOf(geometry),
      geometry,
    });
  }

  const collection = {
    type: 'FeatureCollection',
    metadata: {
      source: `${SOURCE_NAME}, ArcGIS FeatureServer layer 2`,
      sourceUrl: LAYER,
      fetchedAt: new Date().toISOString().slice(0, 10),
      filter: WHERE,
      crs: 'EPSG:4326 (WGS84). Source layer is EPSG:3857; reprojected server side via outSR=4326.',
      simplification:
        `server maxAllowableOffset ${SERVER_OFFSET} deg, ` +
        `Douglas-Peucker tolerance ${LOCAL_TOLERANCE} deg, ` +
        `coordinates rounded to ${PRECISION} decimals`,
      featureCount: features.length,
    },
    features,
  };

  fs.writeFileSync(OUT, JSON.stringify(collection));
  const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(2);
  console.log(`Wrote ${features.length} features (${dropped} dropped) to ${OUT}, ${mb} MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
