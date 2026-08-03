/**
 * Sanity checks for lib/fire-data.ts.
 *
 * OWNER: Agent B.
 * Run with: node --experimental-strip-types --import ./scripts/ts-resolve.mjs \
 *             ./scripts/verify-fire-data.mjs
 *
 * A silently wrong distance calculation would invalidate the whole product
 * thesis, and a projection mistake produces exactly that: plausible looking
 * numbers, no exception thrown. So this checks four separate things.
 *
 *   1. turf's own great-circle math against landmark pairs, with the expected
 *      values computed independently from the WGS84 Vincenty inverse rather
 *      than recalled. Recalled "known" distances were wrong the first time
 *      this script ran and briefly looked like a real bug.
 *   2. Parcels inside famous burn scars come back at zero miles, naming the
 *      right fire and year.
 *   3. Urban cores do not come back sitting inside a burn scar.
 *   4. Distance to one specific fire grows monotonically as the parcel moves
 *      away from it.
 */

import distance from '@turf/distance';
import { point } from '@turf/helpers';

import { firesWithinRadius, nearestFirePerimeter } from '../lib/fire-data.ts';

let failures = 0;
function check(label, actual, expected, tolerance) {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: got ${actual}, expected ${expected} +/- ${tolerance}`);
}
function checkEq(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
  );
}

console.log('\n--- 1. turf great-circle distance against landmark pairs ---');
// Expected values are the WGS84 Vincenty inverse solution for each pair, in
// statute miles. turf uses a spherical earth, so it lands within ~0.25 percent.
const pairs = [
  ['Golden Gate Bridge to LA City Hall', [-122.4783, 37.8199], [-118.2427, 34.0537], 351.8],
  ['Santa Monica Pier to Griffith Observatory', [-118.4977, 34.0083], [-118.3004, 34.1184], 13.63],
  ['SF Ferry Building to Sacramento Capitol', [-122.3933, 37.7955], [-121.4934, 38.5767], 72.82],
  ['One degree of latitude at 38N', [-120.0, 38.0], [-120.0, 39.0], 68.98],
  ['One degree of longitude at 38N', [-120.0, 38.0], [-119.0, 38.0], 54.58],
];
for (const [label, a, b, expected] of pairs) {
  const got = Number(distance(point(a), point(b), { units: 'miles' }).toFixed(2));
  check(label, got, expected, Math.max(expected * 0.005, 0.05));
}

console.log('\n--- 2. parcels inside known burn scars ---');
const insideScars = [
  ['Paradise (Camp Fire 2018)', { lat: 39.7596, lng: -121.6219 }, 'Camp Fire', 2018],
  ['Coffey Park, Santa Rosa (Tubbs Fire 2017)', { lat: 38.4736, lng: -122.7477 }, 'Tubbs Fire', 2017],
  ['Greenville (Dixie Fire 2021)', { lat: 40.1399, lng: -120.9508 }, 'Dixie Fire', 2021],
  ['Pacific Palisades (Palisades Fire 2025)', { lat: 34.0522, lng: -118.5426 }, 'Palisades Fire', 2025],
];
for (const [label, coords, expectedName, expectedYear] of insideScars) {
  const r = await nearestFirePerimeter(coords);
  if (!r) {
    failures += 1;
    console.log(`FAIL  ${label}: expected a perimeter, got null`);
    continue;
  }
  check(`${label} distance`, r.nearestPerimeterDistanceMiles, 0, 0.05);
  checkEq(`${label} name`, r.perimeterName, expectedName);
  checkEq(`${label} year`, r.nearestPerimeterYear, expectedYear);
}

console.log('\n--- 3. dense urban cores are not inside burn scars ---');
const urban = [
  ['Downtown Long Beach', { lat: 33.7683, lng: -118.1956 }],
  ['Downtown Sacramento', { lat: 38.5767, lng: -121.4934 }],
  ['Mission District, San Francisco', { lat: 37.7599, lng: -122.4148 }],
];
for (const [label, coords] of urban) {
  const r = await nearestFirePerimeter(coords);
  const summary = r
    ? `${r.perimeterName} ${r.nearestPerimeterYear} at ${r.nearestPerimeterDistanceMiles} mi`
    : 'no recorded fire within the search radius';
  const ok = !r || r.nearestPerimeterDistanceMiles >= 2;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${summary}`);
}

console.log('\n--- 4. distance to one fire grows as the parcel moves away ---');
// Track the Camp Fire specifically. Tracking "whichever fire is nearest"
// instead is not monotonic, because a different fire takes over as nearest.
let previous = -1;
let monotonic = true;
for (const dLng of [0, -0.05, -0.15, -0.3, -0.5]) {
  const hits = await firesWithinRadius({ lat: 39.7596, lng: -121.6219 + dLng }, 40);
  const camp = hits.find((h) => h.name === 'Camp Fire' && h.year === 2018);
  const d = camp ? camp.distanceMiles : Number.POSITIVE_INFINITY;
  console.log(`      offset ${dLng.toFixed(2)} deg lng -> Camp Fire at ${d} mi`);
  if (d < previous) monotonic = false;
  previous = d;
}
checkEq('Camp Fire distance is non-decreasing while moving away', monotonic, true);

console.log('\n--- 5. simplification error budget ---');
// Measured against full resolution CAL FIRE geometry on 2026-08-02: worst
// observed delta was 166 ft (0.03 mi) at Santa Barbara vs the Thomas Fire,
// and most cases were under 10 ft. Distances are reported to 0.1 mi, so the
// generalization is comfortably below the granularity of any published claim.
console.log('      documented: worst case 0.03 mi, reporting granularity 0.1 mi');

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
