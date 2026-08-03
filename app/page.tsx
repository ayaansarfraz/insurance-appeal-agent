'use client';

/**
 * Single page UI: address plus the insurer's stated reason in, cited
 * reconciliation and appeal letter out.
 *
 * OWNER: Agent B. Talks to POST /api/appeal (Agent A) and renders whatever
 * AppealResponse comes back. Nothing here knows about Mireye or Claude, so the
 * page keeps working once the real pipeline lands behind that endpoint.
 *
 * The non negotiable rule in this file: no value reaches the screen without its
 * source and fetch date next to it. If a new field is added and there is
 * nowhere to get its provenance from, that is a gap in the contract, not a
 * reason to render it bare.
 */

import { useState } from 'react';

import { CitationCard, CitedValue } from './components/citation';
import { demoAddresses } from '@/data/demo-addresses';
import {
  COVERAGE_END_YEAR,
  COVERAGE_START_YEAR,
  FIRE_PERIMETER_SOURCE,
  SEARCH_RADIUS_MILES,
} from '@/lib/fire-source';
import type { AppealResponse } from '@/lib/types';

function humanizeFieldName(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/** Mireye field values are typed unknown in the frozen contract, so format
 *  defensively rather than assuming a shape. */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'not reported';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  }
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(formatValue).join(', ');
  return JSON.stringify(value);
}

function fireHistoryValue(fire: AppealResponse['fireHistory']): string {
  if (!fire) return `none within ${SEARCH_RADIUS_MILES} miles`;
  if (fire.nearestPerimeterDistanceMiles === 0) {
    return `inside the ${fire.perimeterName} perimeter (${fire.nearestPerimeterYear})`;
  }
  return `${fire.nearestPerimeterDistanceMiles} mi to ${fire.perimeterName} (${fire.nearestPerimeterYear})`;
}

/** Short label for the demo chips: the city out of the full address. */
function cityOf(address: string): string {
  return address.split(',')[1]?.trim() ?? address;
}

export default function Home() {
  const [address, setAddress] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AppealResponse | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const res = await fetch('/api/appeal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, insurerStatedReason: reason }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? `Request failed with status ${res.status}.`);
        return;
      }
      setResult(body as AppealResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  }

  const wildfireEntries = Object.entries(result?.parcel.wildfireFields ?? {});
  const floodEntries = Object.entries(result?.parcel.floodFields ?? {});
  const parcelFetchedAt =
    wildfireEntries[0]?.[1].fetchedAt ??
    floodEntries[0]?.[1].fetchedAt ??
    FIRE_PERIMETER_SOURCE.fetchedAt;

  return (
    <div className="mx-auto min-h-screen w-full max-w-4xl px-5 py-10">
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Wildfire Insurance Appeal Agent
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Insurers flag properties using ZIP code and territory level risk models. This checks the
          stated reason against parcel level physical data and the recorded fire history for that
          exact parcel, then drafts an appeal if the reason does not hold up. Every fact below
          carries its source and the date it was retrieved.
        </p>
      </header>

      {/* ---------------- input ---------------- */}
      <form
        onSubmit={submit}
        className="rounded-lg border border-neutral-200 bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-950/60"
      >
        <fieldset className="mb-4">
          <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Demo parcels
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {demoAddresses.map((d) => (
              <button
                key={d.address}
                type="button"
                title={`${d.address}\n\n${d.notes}`}
                onClick={() => {
                  setAddress(d.address);
                  setReason(d.insurerStatedReason);
                }}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  address === d.address
                    ? 'border-neutral-900 bg-neutral-900 text-neutral-50 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                    : 'border-neutral-300 text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-500'
                }`}
              >
                <span
                  aria-hidden
                  className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                    d.expectedMismatch ? 'bg-sky-500' : 'bg-amber-500'
                  }`}
                />
                {cityOf(d.address)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-500">
            <span
              aria-hidden
              className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-sky-500 align-middle"
            />
            expected to find the insurer wrong
            <span
              aria-hidden
              className="ml-4 mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle"
            />
            expected to find the insurer right
          </p>
        </fieldset>

        <label
          htmlFor="address"
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400"
        >
          Property address
        </label>
        <input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
          placeholder="1234 Example St, Santa Rosa, CA 95404"
          className="mb-4 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-400"
        />

        <label
          htmlFor="reason"
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400"
        >
          Insurer&apos;s stated reason
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          rows={3}
          placeholder="Paste the reason given in your non-renewal or premium adjustment notice."
          className="mb-4 w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-400"
        />

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {loading ? 'Checking parcel data and fire history...' : 'Check this parcel'}
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-md border border-rose-600/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-800 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      {/* ---------------- results ---------------- */}
      {result ? (
        <div className="mt-8 space-y-5">
          {/* verdict — suppressed entirely when the explanation failed
              verification. Showing an unverified conclusion in the page's most
              prominent position is the same failure as writing it into a
              letter. The cited data below still renders: it is real and is
              worth reading on its own. */}
          {result.explanationTrusted === false ? (
            <section className="rounded-lg border border-neutral-300 bg-neutral-100/70 p-4 dark:border-neutral-700 dark:bg-neutral-900/60">
              <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                No verdict yet for this parcel
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                The reasoning step has not run against live data, so this tool is not stating
                whether the insurer&apos;s reason holds up. The cited measurements and fire history
                below are real and were retrieved for this exact parcel. Read them directly.
              </p>
            </section>
          ) : (
            <section
              className={`rounded-lg border p-4 ${
                result.reconciliation.partiallySupported
                  ? 'border-violet-600/40 bg-violet-500/10'
                  : result.reconciliation.mismatchFound
                    ? 'border-sky-600/40 bg-sky-500/10'
                    : 'border-amber-600/40 bg-amber-500/10'
              }`}
            >
              <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                {/* A two-sided answer gets its own headline. Flattening it to
                    "supported" or "not supported" is the specific way this tool
                    would mislead someone: the detail is in the paragraph below,
                    and the headline is what people act on. */}
                {result.reconciliation.partiallySupported
                  ? result.reconciliation.mismatchFound
                    ? 'The stated reason does not hold up as written, but the underlying concern is real'
                    : 'The stated reason holds up, but your parcel measures better than the area'
                  : result.reconciliation.mismatchFound
                    ? 'The stated reason is not supported by this parcel'
                    : 'The stated reason is supported by this parcel'}
              </h2>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
                {result.reconciliation.explanation}
              </p>
              {!result.reconciliation.mismatchFound ? (
                <p className="mt-2 text-xs text-neutral-700 dark:text-neutral-300">
                  {result.reconciliation.partiallySupported
                    ? 'No appeal letter was generated, because the hazard finding itself holds up. The parcel level measurements above are still worth putting to your insurer when arguing the size of the adjustment.'
                    : 'No appeal letter was generated, because there is nothing here to appeal. That is a real result, not a failure.'}
                </p>
              ) : null}
            </section>
          )}

          {/* parcel identity */}
          <CitationCard title="Parcel of record" subtitle={result.parcel.address}>
            <CitedValue
              label="coordinates"
              value={`${result.parcel.coordinates.lat.toFixed(5)}, ${result.parcel.coordinates.lng.toFixed(5)}`}
              source="Mireye geocode"
              fetchedAt={parcelFetchedAt}
              note="Everything below is measured at this point, not at the ZIP code or rating territory that contains it."
            />
          </CitationCard>

          {/* fire history */}
          <CitationCard
            title="Recorded wildfire history"
            capturedAt={FIRE_PERIMETER_SOURCE.fetchedAt}
            subtitle={`Distance from the parcel to the nearest point on every recorded perimeter within ${SEARCH_RADIUS_MILES} miles, ${COVERAGE_START_YEAR} through ${COVERAGE_END_YEAR}.`}
          >
            <CitedValue
              label="nearest perimeter"
              value={fireHistoryValue(result.fireHistory)}
              source={FIRE_PERIMETER_SOURCE.source}
              fetchedAt={FIRE_PERIMETER_SOURCE.fetchedAt}
              note={
                result.fireHistory
                  ? FIRE_PERIMETER_SOURCE.precisionNote
                  : 'No recorded fire reached this parcel in the covered window. That absence is the strongest single fact an appeal can carry.'
              }
            />
            <CitedValue
              label="dataset"
              value={FIRE_PERIMETER_SOURCE.coverage}
              source={FIRE_PERIMETER_SOURCE.sourceUrl}
              fetchedAt={FIRE_PERIMETER_SOURCE.fetchedAt}
              note="Public dataset. The link resolves to the live service, so any figure here can be checked independently."
            />
          </CitationCard>

          {/* mireye wildfire fields */}
          {wildfireEntries.length > 0 ? (
            <CitationCard
              title="Parcel level wildfire measurements"
              capturedAt={wildfireEntries[0][1].fetchedAt.slice(0, 10)}
            >
              {wildfireEntries.map(([key, field]) => (
                <CitedValue
                  key={key}
                  label={humanizeFieldName(key)}
                  value={formatValue(field.value)}
                  source={field.source}
                  fetchedAt={field.fetchedAt}
                  confidence={field.confidence}
                />
              ))}
            </CitationCard>
          ) : null}

          {/* mireye flood fields */}
          {floodEntries.length > 0 ? (
            <CitationCard
              title="Parcel level flood measurements"
              capturedAt={floodEntries[0][1].fetchedAt.slice(0, 10)}
            >
              {floodEntries.map(([key, field]) => (
                <CitedValue
                  key={key}
                  label={humanizeFieldName(key)}
                  value={formatValue(field.value)}
                  source={field.source}
                  fetchedAt={field.fetchedAt}
                  confidence={field.confidence}
                />
              ))}
            </CitationCard>
          ) : null}

          {/* supporting facts */}
          {result.reconciliation.supportingFacts.length > 0 ? (
            <section className="rounded-lg border border-neutral-200 bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-950/60">
              <h2 className="mb-1 text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                Findings the conclusion rests on
              </h2>
              <p className="mb-3 text-xs text-neutral-600 dark:text-neutral-400">
                Reason given:{' '}
                <span className="italic">
                  &ldquo;{result.reconciliation.insurerStatedReason}&rdquo;
                </span>
              </p>
              <ol className="space-y-2">
                {result.reconciliation.supportingFacts.map((fact, i) => (
                  <li
                    key={`${fact.claim}-${i}`}
                    className="rounded-md border border-neutral-200 bg-white/60 p-3 dark:border-neutral-800 dark:bg-neutral-900/40"
                  >
                    <p className="text-sm leading-relaxed text-neutral-900 dark:text-neutral-100">
                      {fact.claim}
                    </p>
                    <p className="mt-1.5 break-words font-mono text-[12px] text-neutral-500 dark:text-neutral-400">
                      source = [{fact.source}] · fetched = {fact.fetchedAt}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {/* letter */}
          {result.letter ? (
            <section className="rounded-lg border border-neutral-200 bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-950/60">
              <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                    Draft appeal letter
                  </h2>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    Addressed to the insurer&apos;s underwriting department. Fill in the bracketed
                    fields and send. Keep a copy for a Department of Insurance filing if the carrier
                    does not respond.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(result.letter ?? '');
                    setCopied(true);
                  }}
                  className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-300"
                >
                  {copied ? 'Copied' : 'Copy letter'}
                </button>
              </header>
              <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-md border border-neutral-200 bg-white p-4 font-mono text-[12.5px] leading-relaxed text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
                {result.letter}
              </pre>
            </section>
          ) : result.letterWithheldReason ? (
            /* A mismatch was found but citation checking blocked the letter. Say
               so plainly: silently rendering nothing here would leave the user
               staring at a verdict with no document and no explanation. */
            <section className="rounded-lg border border-amber-300 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
              <h2 className="text-sm font-semibold tracking-tight text-amber-900 dark:text-amber-200">
                No letter generated
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                {result.letterWithheldReason}
              </p>
              {result.rejectedFacts && result.rejectedFacts.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                    Claims dropped because their citation could not be verified:
                  </p>
                  <ul className="mt-1 space-y-1">
                    {result.rejectedFacts.map((fact, i) => (
                      <li
                        key={i}
                        className="text-xs leading-relaxed text-amber-900/80 dark:text-amber-200/80"
                      >
                        <span className="font-mono">{fact.claim}</span>
                        <br />
                        <span className="opacity-75">{fact.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
