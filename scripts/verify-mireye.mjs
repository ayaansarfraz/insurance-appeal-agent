/**
 * Runs demo addresses through the real Mireye API and the local fire perimeter
 * data, and prints what the reconciler will actually see.
 *
 * This is a data-layer check, not a test of the agent: it spends real credits
 * (1 per geocode, 1 per field per location) and its job is to confirm the two
 * sources agree about which parcel they are describing before any reasoning is
 * layered on top.
 *
 *   npm run verify:mireye            # 4 representative addresses
 *   npm run verify:mireye -- --all   # the full demo list
 */

import { geocode, fetchParcelFields } from '../lib/mireye.ts';
import { nearestFirePerimeter, firesWithinRadius } from '../lib/fire-data.ts';
import { demoAddresses } from '../data/demo-addresses.ts';

const SAMPLE = [
  '6295 Skyway, Paradise, CA 95969',
  '200 Pine Ave, Long Beach, CA 90802',
  '300 Esplanade Dr, Oxnard, CA 93036',
  '1300 Ocean Ave, Santa Monica, CA 90401',
];

function fmt(field) {
  if (!field) return 'not reported';
  const unit = field.unit ? ` ${field.unit}` : '';
  const value = typeof field.value === 'number' ? Number(field.value.toFixed(3)) : field.value;
  return `${value}${unit} (${field.confidence}, ${field.source})`;
}

const runAll = process.argv.includes('--all');
const targets = runAll ? demoAddresses : demoAddresses.filter((d) => SAMPLE.includes(d.address));

if (targets.length === 0) {
  console.error('No demo addresses matched. Has data/demo-addresses.ts changed?');
  process.exit(1);
}

console.log(`Running ${targets.length} address(es) through the live pipeline.\n`);

let drift = 0;

for (const demo of targets) {
  console.log('='.repeat(78));
  console.log(demo.address);
  console.log(`  insurer says: ${demo.insurerStatedReason.slice(0, 110)}...`);
  console.log(`  expect mismatch: ${demo.expectedMismatch}`);

  const geo = await geocode(demo.address);
  console.log(`\n  GEOCODE  ${geo.lat}, ${geo.lng}  [${geo.accuracyType}, ${geo.provider}]`);

  // The committed demo coordinates came from Nominatim so fire-data could be
  // exercised without spending credits. Mireye is the authority at runtime; a
  // large gap between the two means the offline fixtures are stale.
  if (demo.approximateCoordinates) {
    const dLat = geo.lat - demo.approximateCoordinates.lat;
    const dLng = geo.lng - demo.approximateCoordinates.lng;
    const approxMiles = Math.hypot(dLat * 69, dLng * 69 * Math.cos((geo.lat * Math.PI) / 180));
    const flag = approxMiles > 0.25 ? '  <-- DRIFT' : '';
    if (approxMiles > 0.25) drift += 1;
    console.log(`           offline fixture differs by ${approxMiles.toFixed(2)} mi${flag}`);
  }

  const { parcel, unavailableFields } = await fetchParcelFields(demo.address, geo, [
    'wildfire_underwrite',
    'natural_hazard',
  ]);

  console.log('\n  MIREYE PARCEL FACTS');
  for (const key of ['slope_degrees', 'tree_canopy_pct', 'ndvi_current', 'lcms_class', 'elevation']) {
    console.log(`    ${key.padEnd(24)} ${fmt(parcel.wildfireFields[key])}`);
  }
  const tract = parcel.wildfireFields.wildfire_annual_frequency;
  console.log(`    ${'wildfire_annual_freq'.padEnd(24)} ${fmt(tract)}   <-- TRACT level`);
  if (unavailableFields.length) {
    console.log(`    unavailable: ${unavailableFields.join(', ')}`);
  }

  const nearest = await nearestFirePerimeter(geo);
  const within5 = await firesWithinRadius(geo, 5);
  console.log('\n  FIRE PERIMETER HISTORY');
  if (nearest) {
    const where =
      nearest.nearestPerimeterDistanceMiles === 0
        ? 'parcel is INSIDE this perimeter'
        : `${nearest.nearestPerimeterDistanceMiles} mi away`;
    console.log(`    nearest: ${nearest.perimeterName} ${nearest.nearestPerimeterYear}, ${where}`);
  } else {
    console.log('    no recorded perimeter within the search radius');
  }
  console.log(`    within 5 mi: ${within5.length} recorded fires`);
  if (within5.length) {
    const acres = within5.map((f) => f.acres ?? 0);
    console.log(`      largest ${Math.max(...acres).toLocaleString()} acres, most recent ${within5[0].year}`);
  }
  console.log();
}

console.log('='.repeat(78));
console.log(drift === 0 ? 'Done. Offline fixtures agree with Mireye.' : `Done. ${drift} address(es) drifted from their offline fixture.`);
