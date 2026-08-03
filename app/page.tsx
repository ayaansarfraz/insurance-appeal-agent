'use client';

/**
 * Single page UI: address plus the insurer's stated reason in, cited
 * reconciliation and appeal letter out.
 *
 * Talks to POST /api/appeal and renders whatever AppealResponse comes back.
 * Nothing here knows about Mireye or Claude, so the page keeps working as the
 * pipeline behind that endpoint changes.
 *
 * The layout is an argument in three steps: what the insurer said, what the
 * record shows, what to do about it. The verdict sits in the top right and the
 * agent's own path sits in the sidebar, so a reader can see both the conclusion
 * and how it was reached without scrolling into prose.
 *
 * The non negotiable rule in this file: no value reaches the screen without its
 * source and fetch date next to it. If a new field is added and there is
 * nowhere to get its provenance from, that is a gap in the contract, not a
 * reason to render it bare.
 */

import { useState } from 'react';

import { CaseTimeline } from './components/case-timeline';
import { CitationGroup, CitedValue } from './components/citation';
import { EvidenceChecklist } from './components/evidence-checklist';
import { StepCard, Tag } from './components/step-card';
import { VerdictCallout, type VerdictState } from './components/verdict-callout';
import { justifiedAddresses, mismatchAddresses } from '@/data/demo-addresses';
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

function verdictState(result: AppealResponse): VerdictState {
  // An unverified conclusion in the most prominent position on the page is the
  // same failure as writing one into a letter, so it never gets a verdict word.
  if (result.explanationTrusted === false) return 'withheld';
  if (result.reconciliation.partiallySupported) return 'partial';
  return result.reconciliation.mismatchFound ? 'mismatch' : 'supported';
}

/**
 * The one line under the verdict. For a two sided answer this line is carrying
 * the half that the headline word leaves out, so it is not decoration: someone
 * who reads "Partially supported" and nothing else must not walk away with the
 * wrong conclusion.
 */
function verdictContext(result: AppealResponse, state: VerdictState): string {
  const n = result.reconciliation.supportingFacts.length;
  const facts = `${n} cited ${n === 1 ? 'fact' : 'facts'}`;

  switch (state) {
    case 'withheld':
      return 'The reasoning step could not be verified against the sources fetched, so no conclusion is stated here. The record below is real, and worth reading directly.';
    case 'partial':
      return result.reconciliation.mismatchFound
        ? `The stated reason does not hold up as written, but the underlying concern is real. Based on ${facts}.`
        : `The stated reason holds up, though this parcel measures better than the area around it. Based on ${facts}.`;
    case 'mismatch':
      return `${facts} give a basis to contest this decision as stated.`;
    case 'supported':
      return `${facts} back the insurer's stated reason for this parcel.`;
  }
}

const INTRO_COPY =
  'Insurers flag properties using ZIP code and territory level risk models. This checks the stated reason against parcel level physical data and the recorded fire history for that exact parcel, then drafts an appeal if the reason does not hold up. Every fact carries its source and the date it was retrieved.';

const WITHHELD_COPY =
  'The reasoning step could not be verified against the sources fetched, so this tool is not stating whether the insurer reason holds up. The cited measurements and fire history below are real and were retrieved for this exact parcel.';

/** Past this length the finding stops being a summary and starts being the wall
 *  of text this layout exists to avoid, so it gets clamped behind a toggle. */
const CLAMP_OVER_CHARS = 400;

export default function Home() {
  const [address, setAddress] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AppealResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [showFullFinding, setShowFullFinding] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    setShowFullFinding(false);
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

  const state = result ? verdictState(result) : null;
  const finding = result
    ? result.explanationTrusted === false
      ? WITHHELD_COPY
      : result.reconciliation.explanation
    : INTRO_COPY;
  const clampable = Boolean(result) && finding.length > CLAMP_OVER_CHARS;
  const fieldClasses =
    'w-full rounded-[2px] border border-rule bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted/70 focus:border-amber';
  const labelClasses = 'mb-1.5 block font-mono text-[11px] uppercase tracking-[0.14em] text-ink';

  function DemoRow({
    label,
    items,
  }: {
    label: string;
    items: typeof justifiedAddresses;
  }) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[11px] text-ink-muted">{label}</span>
        {items.map((d) => (
          <button
            key={d.address}
            type="button"
            title={`${d.address}\n\n${d.notes}`}
            onClick={() => {
              setAddress(d.address);
              setReason(d.insurerStatedReason);
            }}
            className={`text-[13px] underline-offset-4 hover:text-ink ${
              address === d.address
                ? 'text-ink underline decoration-amber decoration-2'
                : 'text-ink-muted underline decoration-rule'
            }`}
          >
            {cityOf(d.address)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      {/* ---------------- demo picker ---------------- */}
      <div className="mb-10 space-y-1.5 border-b border-rule pb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          Demo parcels
        </p>
        <DemoRow label="flag expected to hold up" items={justifiedAddresses} />
        <DemoRow label="flag expected to fail" items={mismatchAddresses} />
      </div>

      {/* ---------------- header ---------------- */}
      <header className="grid items-start gap-8 lg:grid-cols-[1fr_20rem] lg:gap-12">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            {result ? (
              <>
                <Tag>Parcel record reviewed</Tag>
                {result.fireHistory ? (
                  <Tag>
                    {result.fireHistory.perimeterName} &middot;{' '}
                    {result.fireHistory.nearestPerimeterYear}
                  </Tag>
                ) : (
                  <Tag>No recorded fire within {SEARCH_RADIUS_MILES} miles</Tag>
                )}
              </>
            ) : (
              <>
                <Tag>California parcels</Tag>
                <Tag>
                  CAL FIRE {COVERAGE_START_YEAR} to {COVERAGE_END_YEAR}
                </Tag>
              </>
            )}
          </div>

          <h1 className="mt-5 max-w-2xl font-serif text-3xl leading-tight font-normal text-ink sm:text-4xl">
            {result ? `Appeal for ${result.parcel.address}` : 'What the record says about your parcel'}
          </h1>

          {/* The agent writes as much as the case needs, which on a complicated
              parcel is several hundred words. Clamped rather than truncated:
              the reader gets the shape of the finding above the fold and the
              whole thing on request, and nothing is thrown away. */}
          <div className="mt-4 max-w-2xl">
            <p
              className={`text-[15px] leading-relaxed whitespace-pre-wrap text-ink-muted ${
                clampable && !showFullFinding ? 'line-clamp-4' : ''
              }`}
            >
              {finding}
            </p>
            {clampable ? (
              <button
                type="button"
                onClick={() => setShowFullFinding((v) => !v)}
                className="mt-2 font-mono text-[11px] tracking-[0.14em] text-amber uppercase underline underline-offset-4"
              >
                {showFullFinding ? 'Show less' : 'Read the full finding'}
              </button>
            ) : null}
          </div>
        </div>

        {result && state ? <VerdictCallout state={state} context={verdictContext(result, state)} /> : null}
      </header>

      {/* ---------------- body ---------------- */}
      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1fr_20rem] lg:gap-12">
        <div className="min-w-0 space-y-6">
          {/* STEP 1: the notice */}
          <StepCard
            step={1}
            title="What the insurer says"
            subtitle="Paste the reason given in the non-renewal or premium notice, word for word. The agent reasons about the reason as written, so paraphrasing it changes the answer."
          >
            <form onSubmit={submit}>
              <label htmlFor="address" className={labelClasses}>
                Property address
              </label>
              <input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                placeholder="1234 Example St, Santa Rosa, CA 95404"
                className={`${fieldClasses} mb-5`}
              />

              <label htmlFor="reason" className={labelClasses}>
                Insurer&apos;s stated reason
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={3}
                placeholder="Property is located in a ZIP code identified by our wildfire model as elevated risk."
                className={`${fieldClasses} mb-5 resize-y`}
              />

              <button
                type="submit"
                disabled={loading}
                className="rounded-[2px] bg-ink px-4 py-2.5 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Checking parcel data and fire history...' : 'Check this parcel'}
              </button>
            </form>

            {error ? (
              <p className="mt-4 rounded-[2px] border border-amber bg-amber-tint px-3 py-2 text-sm text-ink">
                {error}
              </p>
            ) : null}
          </StepCard>

          {/* STEP 2: the record */}
          {result ? (
            <StepCard
              step={2}
              title="What the parcel record shows"
              subtitle="Measured at this parcel, not at the ZIP code or rating territory that contains it. Every source below resolves, so any figure here can be checked independently."
            >
              <CitationGroup title="Parcel of record" subtitle={result.parcel.address}>
                <CitedValue
                  label="Coordinates"
                  value={`${result.parcel.coordinates.lat.toFixed(5)}, ${result.parcel.coordinates.lng.toFixed(5)}`}
                  source="Mireye geocode"
                  fetchedAt={parcelFetchedAt}
                />
              </CitationGroup>

              <CitationGroup
                title="Recorded wildfire history"
                capturedAt={FIRE_PERIMETER_SOURCE.fetchedAt}
                subtitle={`Distance to the nearest point on every recorded perimeter within ${SEARCH_RADIUS_MILES} miles, ${COVERAGE_START_YEAR} through ${COVERAGE_END_YEAR}.`}
              >
                <CitedValue
                  label="Nearest perimeter"
                  value={fireHistoryValue(result.fireHistory)}
                  source={FIRE_PERIMETER_SOURCE.source}
                  sourceUrl={FIRE_PERIMETER_SOURCE.sourceUrl}
                  fetchedAt={FIRE_PERIMETER_SOURCE.fetchedAt}
                  note={
                    result.fireHistory
                      ? undefined
                      : 'No recorded fire reached this parcel in the covered window. That absence is the strongest single fact an appeal can carry.'
                  }
                />
                <CitedValue
                  label="Dataset"
                  value={FIRE_PERIMETER_SOURCE.coverage}
                  source={FIRE_PERIMETER_SOURCE.sourceUrl}
                  sourceUrl={FIRE_PERIMETER_SOURCE.sourceUrl}
                  fetchedAt={FIRE_PERIMETER_SOURCE.fetchedAt}
                  note={FIRE_PERIMETER_SOURCE.precisionNote}
                />
              </CitationGroup>

              {wildfireEntries.length > 0 ? (
                <CitationGroup
                  title="Wildfire measurements"
                  capturedAt={wildfireEntries[0][1].fetchedAt}
                >
                  {wildfireEntries.map(([key, field]) => (
                    <CitedValue
                      key={key}
                      label={humanizeFieldName(key)}
                      value={formatValue(field.value)}
                      unit={field.unit}
                      source={field.source}
                      sourceUrl={field.sourceUrl}
                      fetchedAt={field.fetchedAt}
                      confidence={field.confidence}
                    />
                  ))}
                </CitationGroup>
              ) : null}

              {floodEntries.length > 0 ? (
                <CitationGroup title="Flood measurements" capturedAt={floodEntries[0][1].fetchedAt}>
                  {floodEntries.map(([key, field]) => (
                    <CitedValue
                      key={key}
                      label={humanizeFieldName(key)}
                      value={formatValue(field.value)}
                      unit={field.unit}
                      source={field.source}
                      sourceUrl={field.sourceUrl}
                      fetchedAt={field.fetchedAt}
                      confidence={field.confidence}
                    />
                  ))}
                </CitationGroup>
              ) : null}

              {/* A field that could not be retrieved is not a benign reading.
                  Saying so beats leaving a silent hole in the record. */}
              {result.unavailableFields && result.unavailableFields.length > 0 ? (
                <p className="mt-5 border-t border-rule pt-3 text-xs leading-relaxed text-ink-muted">
                  Not retrieved for this parcel:{' '}
                  <span className="font-mono">{result.unavailableFields.join(', ')}</span>. A missing
                  reading is not a favourable one, and nothing above was inferred from these.
                </p>
              ) : null}
            </StepCard>
          ) : null}

          {/* STEP 3: the letter, or a plain account of why there is none */}
          {result ? (
            result.letter ? (
              <StepCard
                step={3}
                title="Draft appeal letter"
                subtitle="Addressed to the insurer's underwriting department. Fill in the bracketed fields and send. Keep a copy for a Department of Insurance filing if the carrier does not respond."
              >
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(result.letter ?? '');
                    setCopied(true);
                  }}
                  className="mb-3 rounded-[2px] border border-rule px-3 py-1.5 text-xs text-ink hover:border-amber"
                >
                  {copied ? 'Copied' : 'Copy letter'}
                </button>
                <pre className="max-h-[32rem] overflow-auto rounded-[2px] border border-rule bg-white p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-ink">
                  {result.letter}
                </pre>
              </StepCard>
            ) : result.letterWithheldReason ? (
              <StepCard step={3} title="No letter generated">
                <p className="text-sm leading-relaxed text-ink-muted">
                  {result.letterWithheldReason}
                </p>
                {result.rejectedFacts && result.rejectedFacts.length > 0 ? (
                  <div className="mt-4 border-t border-rule pt-3">
                    <p className="text-xs text-ink">
                      Claims dropped because their citation could not be verified:
                    </p>
                    <ul className="mt-2 space-y-2">
                      {result.rejectedFacts.map((fact, i) => (
                        <li key={i} className="text-xs leading-relaxed text-ink-muted">
                          <span className="font-mono">{fact.claim}</span>
                          <br />
                          <span className="opacity-80">{fact.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </StepCard>
            ) : (
              <StepCard step={3} title="No appeal letter">
                <p className="text-sm leading-relaxed text-ink-muted">
                  {result.reconciliation.partiallySupported
                    ? 'No letter was generated, because the hazard finding itself holds up. The parcel level measurements above are still worth putting to your insurer when arguing the size of the adjustment.'
                    : 'No letter was generated, because there is nothing here to appeal. That is a real result, not a failure.'}
                </p>
              </StepCard>
            )
          ) : null}
        </div>

        {/* ---------------- sidebar ---------------- */}
        <aside className="min-w-0 space-y-6 lg:sticky lg:top-10">
          {result ? (
            <>
              <CaseTimeline result={result} />
              <EvidenceChecklist facts={result.reconciliation.supportingFacts} />
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
