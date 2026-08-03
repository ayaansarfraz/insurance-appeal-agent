/**
 * The findings the conclusion rests on, as a checklist.
 *
 * These arrive already audited by lib/citation-guard.ts: anything in this list
 * cited a source that was actually fetched. That is exactly why the source and
 * date render on every line rather than on hover. A checkmark next to an
 * unsourced sentence is the failure mode this whole project exists to avoid.
 */

import { asDate } from './citation';

export function EvidenceChecklist({
  facts,
}: {
  facts: Array<{ claim: string; source: string; fetchedAt: string }>;
}) {
  if (facts.length === 0) return null;

  return (
    <section className="border border-rule bg-white/45 p-5">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-amber">
        Supporting facts
      </h2>
      <ul className="mt-4 space-y-3.5">
        {facts.map((fact, i) => (
          <li key={`${fact.claim}-${i}`} className="flex gap-2.5">
            <span aria-hidden className="mt-px shrink-0 text-amber">
              &#10003;
            </span>
            <div className="min-w-0">
              <p className="text-[13px] leading-snug text-ink">{fact.claim}</p>
              <p className="mt-1 font-mono text-[11px] break-words text-ink-muted">
                {fact.source} &middot; {asDate(fact.fetchedAt)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
