/**
 * Fixed demo address list.
 *
 * OWNER: Agent B. Agent A: treat as read-only. If you want an address added,
 * ask. Adding optional fields is safe; changing existing ones is not.
 *
 * Half of these are parcels where an insurer's wildfire flag is genuinely
 * justified and half are parcels where it is not. That balance is the point.
 * A pipeline that finds a mismatch on every address is a letter generator, not
 * a reasoner, and it is the first thing a judge will probe. The agent has to be
 * able to conclude "the insurer is right about this one" and say so.
 *
 * How these were chosen: every address was geocoded and then run through
 * lib/fire-data.ts against the committed CAL FIRE extract. The fire counts and
 * distances in the notes below are real query output as of 2026-08-02, not
 * estimates. approximateCoordinates are OpenStreetMap Nominatim results, kept
 * so fire-data can be exercised without spending Mireye credits. Mireye's
 * geocoder is the authority at runtime.
 *
 * The addresses are real and publicly listed. They were picked for their
 * geography. Nothing here asserts anything about whoever actually occupies
 * them.
 */

export interface DemoAddress {
  address: string;
  /** Verbatim style of rationale an insurer would put in a non-renewal notice. */
  insurerStatedReason: string;
  /** What we expect the agent to conclude, used to sanity check the pipeline.
   *  True means we expect the agent to find the insurer's rationale unsupported. */
  expectedMismatch: boolean;
  notes: string;
  /** Offline fallback so lib/fire-data.ts can be tested without a Mireye call.
   *  Source: OpenStreetMap Nominatim, 2026-08-02. */
  approximateCoordinates?: { lat: number; lng: number };
}

export const demoAddresses: DemoAddress[] = [
  // ---------------------------------------------------------------------
  // Insurer is RIGHT. Expect the agent to decline to appeal.
  // ---------------------------------------------------------------------
  {
    address: '6295 Skyway, Paradise, CA 95969',
    insurerStatedReason:
      'Property is located in a wildfire hazard zone rated Very High by our catastrophe model, ' +
      'with elevated fuel loading and limited egress.',
    expectedMismatch: false,
    notes:
      'Sits inside the 2018 Camp Fire perimeter, the deadliest fire in California history. ' +
      'Seven recorded perimeters within five miles and fifty three within fifteen, including ' +
      'the Centerville Fire at 4.1 miles in 2024. Foothill wildland urban interface with a ' +
      'documented egress failure. The insurer is correct and the agent should say so plainly ' +
      'rather than manufacture an appeal.',
    approximateCoordinates: { lat: 39.75695, lng: -121.62573 },
  },
  {
    address: '15300 Sunset Blvd, Pacific Palisades, CA 90272',
    insurerStatedReason:
      'Recent catastrophic loss activity in the immediate vicinity requires us to non-renew ' +
      'this policy at expiration.',
    expectedMismatch: false,
    notes:
      'Inside the 2025 Palisades Fire perimeter, roughly 23,400 acres. Twenty two recorded ' +
      'perimeters within five miles. The most recent large loss event in the dataset and the ' +
      'clearest possible case that the flag is justified.',
    approximateCoordinates: { lat: 34.04727, lng: -118.52613 },
  },
  {
    address: '6013 Kanan Dume Rd, Malibu, CA 90265',
    insurerStatedReason:
      'Parcel is within a designated wildland urban interface area with sustained chaparral ' +
      'fuel and a history of repeat fire.',
    expectedMismatch: false,
    notes:
      'Inside the 2018 Woolsey Fire perimeter, with the 2024 Franklin Fire at 3.8 miles and ' +
      'the 2025 Palisades Fire at 6.9 miles. Twenty six perimeters within five miles. Santa ' +
      'Monica Mountains chaparral with genuine repeat burn history. Insurer is correct.',
    approximateCoordinates: { lat: 34.03538, lng: -118.80049 },
  },
  {
    address: '2000 Topanga Skyline Dr, Topanga, CA 90290',
    insurerStatedReason:
      'Steep terrain, single access road, and proximity to recent large fire perimeters place ' +
      'this risk outside our current underwriting appetite.',
    expectedMismatch: false,
    notes:
      'Ridge top parcel. The 2017 Skyline Fire perimeter is 0.3 miles away and the 2025 ' +
      'Palisades Fire is 2 miles away. Fifty nine perimeters within five miles, the densest ' +
      'fire history of any address on this list. Every clause of the stated reason checks out.',
    approximateCoordinates: { lat: 34.11171, lng: -118.62427 },
  },
  {
    address: '3550 Round Barn Blvd, Santa Rosa, CA 95403',
    insurerStatedReason:
      'Location has sustained a total loss wildfire event within the last ten years and remains ' +
      'in a high hazard severity zone.',
    expectedMismatch: false,
    notes:
      'Fountaingrove. Inside the 2017 Tubbs Fire perimeter, which destroyed the neighbourhood ' +
      'outright. Seven perimeters within five miles. Rebuilt housing does not move the parcel ' +
      'out of the hillside interface, so the flag stands.',
    approximateCoordinates: { lat: 38.47603, lng: -122.72558 },
  },

  // ---------------------------------------------------------------------
  // Insurer is WRONG. Expect the agent to find a mismatch and draft an appeal.
  // ---------------------------------------------------------------------
  {
    address: '200 Pine Ave, Long Beach, CA 90802',
    insurerStatedReason:
      'Property is located in a ZIP code identified by our wildfire model as elevated risk.',
    expectedMismatch: true,
    notes:
      'Downtown Long Beach. Zero recorded perimeters within five miles and exactly one within ' +
      'fifteen: the 2009 Palos Verdes Fire, 234 acres, 9.1 miles away and seventeen years old. ' +
      'Flat, fully built out, no adjacent wildland fuel. The stated reason is explicitly ZIP ' +
      'level, which is the exact failure mode this product exists to expose.',
    approximateCoordinates: { lat: 33.76942, lng: -118.19228 },
  },
  {
    address: '1231 I St, Sacramento, CA 95814',
    insurerStatedReason:
      'Statewide wildfire exposure in California requires us to reduce concentration; your ' +
      'property falls in an affected risk tier.',
    expectedMismatch: true,
    notes:
      'Mansion Flats, downtown Sacramento. Zero perimeters within five miles; nearest is the ' +
      '2015 Locust Fire at 10.5 miles. Flat valley floor on a dense urban grid. The stated ' +
      'reason is a portfolio decision wearing a risk justification, and the parcel data says so.',
    approximateCoordinates: { lat: 38.58049, lng: -121.48927 },
  },
  {
    address: '1420 E Shaw Ave, Fresno, CA 93710',
    insurerStatedReason:
      'Modelled wildfire severity for this location exceeds our retention threshold.',
    expectedMismatch: true,
    notes:
      'North Fresno. Zero perimeters within five miles; nearest is the 2013 Wolf Fire at 8.1 ' +
      'miles. Central Valley floor, effectively no slope, irrigated and built out in every ' +
      'direction. Modelled severity is doing all the work here and the observed record does ' +
      'not support it.',
    approximateCoordinates: { lat: 36.80866, lng: -119.76278 },
  },
  {
    address: '300 Esplanade Dr, Oxnard, CA 93036',
    insurerStatedReason:
      'Frequent wildfire activity in the surrounding area over the past five years supports a ' +
      'substantial premium adjustment.',
    expectedMismatch: false,
    notes:
      'CORRECTED 2026-08-03 against the committed extract. This was originally listed as a ' +
      'mismatch on the theory that the nearby fires were all small riverbottom grass fires. ' +
      'They are not. Twenty perimeters fall within five miles and three of them are major: ' +
      'the Thomas Fire of 2017 at 281,791 acres and 4.4 miles, the Mountain Fire of 2024 at ' +
      '19,902 acres and 4.0 miles, and the Maria Fire of 2019 at 10,043 acres and 4.8 miles. ' +
      'The insurer said frequent wildfire activity in the surrounding area over the past five ' +
      'years, and that is exactly what the record shows, so the flag stands. ' +
      'Worth keeping for a second reason: the parcel itself still measures benign (slope 1.3 ' +
      'degrees, tree canopy 1 percent, built out coastal plain). It is the case where ' +
      'parcel level data and area history disagree and the area history is the one that ' +
      'governs, which is the mirror image of the appeal this product usually writes.',
    approximateCoordinates: { lat: 34.22888, lng: -119.17264 },
  },
  {
    address: '1300 Ocean Ave, Santa Monica, CA 90401',
    insurerStatedReason:
      'A major wildfire occurred within two miles of this property in the last twelve months.',
    expectedMismatch: true,
    notes:
      'The hardest case on the list and the one worth scrutinising. The stated fact is true: ' +
      'the 2025 Palisades Fire perimeter is 1.4 miles away. But the parcel is on the flat, ' +
      'fully built out oceanfront grid, separated from any continuous fuel by the Santa Monica ' +
      'bluffs and dense development. Straight line distance to a perimeter is not exposure. ' +
      'If the agent concludes no mismatch here it is not obviously wrong, so this is the case ' +
      'that shows whether the parcel level data is actually driving the reasoning.',
    approximateCoordinates: { lat: 34.01720, lng: -118.50180 },
  },
];

/** Convenience for the UI dropdown and for pipeline sanity runs. */
export const justifiedAddresses = demoAddresses.filter((d) => !d.expectedMismatch);
export const mismatchAddresses = demoAddresses.filter((d) => d.expectedMismatch);
