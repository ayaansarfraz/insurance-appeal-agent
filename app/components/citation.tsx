/**
 * Citation display primitives.
 *
 * The whole premise of the project is that a claim without its provenance is
 * worthless, so provenance is not a footnote here: it renders on the same line
 * as the value it belongs to, always, at a size that can actually be read.
 *
 * This file was rebuilt for density. The previous version stacked four rows per
 * fact (value, source, fetched, confidence) which turned a dozen honest
 * measurements into a wall of text, and readers stopped reading. One fact is
 * now one line. Note that the fix was layout, never dropping a citation.
 *
 * Rule for anything added to this file: if a component can render a value, it
 * must require a source and a fetchedAt to render it. Making the citation
 * optional is how citations quietly go missing.
 */

import type { ReactNode } from 'react';

function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

/** Mireye timestamps arrive as full ISO instants. The time of day is noise in a
 *  citation line; the date is the part that matters for auditing. */
export function asDate(fetchedAt: string): string {
  return /^\d{4}-\d{2}-\d{2}T/.test(fetchedAt) ? fetchedAt.slice(0, 10) : fetchedAt;
}

/**
 * Sources arrive either as a bare URL, as prose, or as prose with a URL buried
 * in it. Whichever it is, the reader gets something they can go check.
 * An explicit sourceUrl wins: it is the field Mireye guarantees resolves.
 */
function SourceValue({ source, sourceUrl }: { source: string; sourceUrl?: string | null }) {
  const trimmed = source.trim();
  const link = sourceUrl?.trim() || (isUrl(trimmed) ? trimmed : trimmed.match(/https?:\/\/\S+/)?.[0]);

  if (!link) return <span>{trimmed}</span>;

  // When the source is nothing but a URL there is no prose to label it with, so
  // the URL itself is the label.
  const label = isUrl(trimmed) && trimmed === link ? trimmed : trimmed.replace(/\s*https?:\/\/\S+/, '');

  return (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      title={`${trimmed}\n${link}`}
      className="text-amber underline decoration-dotted underline-offset-2 hover:decoration-solid"
    >
      {label || link}
    </a>
  );
}

/**
 * Confidence, in one hue. High reads as a filled tag, anything else as an
 * outline: a low confidence reading is not an error to flag in red, it is a
 * measurement the reader should weigh less.
 */
export function ConfidencePill({ confidence }: { confidence: string }) {
  const high = confidence.trim().toLowerCase() === 'high';
  return (
    <span
      className={`shrink-0 rounded-[2px] px-1.5 py-px font-mono text-[10px] tracking-wide ${
        high ? 'bg-amber-tint text-amber' : 'border border-rule text-ink-muted'
      }`}
    >
      {confidence}
    </span>
  );
}

export interface CitedValueProps {
  /** Field name as the user should read it, for example "Slope". */
  label: string;
  /** Already formatted for display. */
  value: ReactNode;
  /** Unit of measure, rendered with the value. "Slope 12.4" is ambiguous. */
  unit?: string | null;
  source: string;
  sourceUrl?: string | null;
  fetchedAt: string;
  confidence?: string;
  /** Optional one line explanation of what the number means for an appeal.
   *  Use sparingly: a note on every row rebuilds the wall of text. */
  note?: string;
}

/**
 * One fact and everything needed to audit it, on one line. Source and fetchedAt
 * are required by the type, not optional, on purpose.
 */
export function CitedValue({
  label,
  value,
  unit,
  source,
  sourceUrl,
  fetchedAt,
  confidence,
  note,
}: CitedValueProps) {
  return (
    <div className="border-b border-rule/70 py-2.5 last:border-b-0">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="w-full shrink-0 text-[13px] text-ink-muted sm:w-52">{label}</span>
        <span className="font-mono text-[13px] font-medium text-ink">
          {value}
          {unit ? <span className="font-normal text-ink-muted"> {unit}</span> : null}
        </span>
        {confidence ? <ConfidencePill confidence={confidence} /> : null}
        <span className="ml-auto min-w-0 max-w-full truncate font-mono text-[11px] text-ink-muted sm:max-w-[18rem]">
          <SourceValue source={source} sourceUrl={sourceUrl} /> &middot; {asDate(fetchedAt)}
        </span>
      </div>
      {note ? (
        <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-ink-muted sm:ml-52">{note}</p>
      ) : null}
    </div>
  );
}

/**
 * A labelled run of cited values inside a step card. This is deliberately not a
 * card of its own: nesting boxes inside boxes is what made the old results
 * screen read as a pile of containers rather than an argument.
 */
export function CitationGroup({
  title,
  capturedAt,
  subtitle,
  children,
}: {
  title: string;
  capturedAt?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-5 min-w-0 first:mt-0">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-rule pb-1.5">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink">{title}</h3>
        {capturedAt ? (
          <span className="rounded-[2px] bg-amber-tint px-1.5 py-px font-mono text-[10px] text-amber">
            captured {asDate(capturedAt)}
          </span>
        ) : null}
      </header>
      {subtitle ? <p className="mt-2 max-w-prose text-xs text-ink-muted">{subtitle}</p> : null}
      <div className="mt-1">{children}</div>
    </section>
  );
}
