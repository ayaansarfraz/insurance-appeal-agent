/**
 * Runs the reconciliation agent against the demo addresses and scores it
 * against the expected outcome recorded in data/demo-addresses.ts.
 *
 * This is the check that matters. A pipeline that always finds a mismatch is a
 * letter generator, so the pass condition is not "it produced a letter" but
 * "it agreed with the expected verdict, including on the parcels where the
 * insurer is right".
 *
 * Spends real credits and real tokens on every run.
 *
 *   npm run verify:agent            # 4 representative parcels
 *   npm run verify:agent -- --all   # all 10
 */

import { runAppealAgent } from '../lib/agent.ts';
import { auditCitations } from '../lib/citation-guard.ts';
import { demoAddresses } from '../data/demo-addresses.ts';

const SAMPLE = [
  '6295 Skyway, Paradise, CA 95969', // insurer right, and the vegetation trap
  '200 Pine Ave, Long Beach, CA 90802', // insurer wrong, clear cut
  '300 Esplanade Dr, Oxnard, CA 93036', // insurer right, needs severity reasoning
  '1300 Ocean Ave, Santa Monica, CA 90401', // insurer wrong, megafire 1.4 mi away
];

const runAll = process.argv.includes('--all');
const targets = runAll ? demoAddresses : demoAddresses.filter((d) => SAMPLE.includes(d.address));

let correct = 0;
let citationFailures = 0;
const rows = [];

for (const demo of targets) {
  process.stdout.write(`\n${'='.repeat(78)}\n${demo.address}\n`);
  process.stdout.write(`  stated reason: ${demo.insurerStatedReason.slice(0, 100)}...\n`);

  const started = Date.now();
  let run;
  try {
    run = await runAppealAgent(demo.address, demo.insurerStatedReason);
  } catch (err) {
    console.log(`  AGENT ERROR: ${err.message}`);
    rows.push({ address: demo.address, ok: false, note: 'errored' });
    continue;
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  const audit = auditCitations(run.reconciliation, run.parcel, run.fireHistory);
  const ok = run.reconciliation.mismatchFound === demo.expectedMismatch;
  if (ok) correct += 1;
  if (!audit.clean) citationFailures += 1;

  console.log(`  presets chosen : ${run.presetsChosen.join(', ') || 'none'}`);
  console.log(`  tool path      : ${run.toolCalls.join(' -> ')}`);
  console.log(`  fire history   : ${
    run.fireHistory
      ? `${run.fireHistory.perimeterName} ${run.fireHistory.nearestPerimeterYear} at ${run.fireHistory.nearestPerimeterDistanceMiles} mi`
      : 'none within radius'
  }`);
  console.log(
    `  verdict        : mismatchFound=${run.reconciliation.mismatchFound} (expected ${demo.expectedMismatch}) ${ok ? 'CORRECT' : '*** WRONG ***'}`,
  );
  console.log(`  two sided      : partiallySupported=${Boolean(run.reconciliation.partiallySupported)}`);
  console.log(`  citations      : ${audit.verifiedFacts.length} verified, ${audit.rejectedFacts.length} rejected`);
  for (const r of audit.rejectedFacts) console.log(`     REJECTED: ${r.source} -- ${r.reason.slice(0, 90)}`);
  console.log(`  took           : ${seconds}s`);
  console.log(`\n  ${run.reconciliation.explanation.replace(/\n/g, '\n  ')}`);

  if (run.reconciliation.explanation.includes('—')) {
    console.log('  *** contains an em dash, which the conventions forbid ***');
  }

  rows.push({ address: demo.address, ok, expected: demo.expectedMismatch, got: run.reconciliation.mismatchFound });
}

console.log(`\n${'='.repeat(78)}`);
console.log(`Verdicts correct : ${correct}/${targets.length}`);
console.log(`Citation failures: ${citationFailures}/${targets.length}`);
for (const r of rows) {
  if (!r.ok) console.log(`  MISS: ${r.address} expected ${r.expected}, got ${r.got}`);
}
process.exit(correct === targets.length && citationFailures === 0 ? 0 : 1);
