/**
 * Citation display primitives.
 *
 * OWNER: Agent B.
 *
 * This is the one place in the UI worth visual investment. The whole premise of
 * the project is that a claim without its provenance is worthless, so the
 * provenance is not a footnote here, it renders at the same weight as the value
 * it belongs to. The layout deliberately mirrors Mireye's own "with citation"
 * card: monospace key = value rows, the source rendered as something you can go
 * check, an explicit fetch date, and a confidence marker.
 *
 * Rule for anything added to this file: if a component can render a value, it
 * must require a source and a fetchedAt to render it. Making the citation
 * optional is how citations quietly go missing.
 */

import type { ReactNode } from 'react';

function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

/** Sources arrive either as a bare URL or as prose that may contain one. */
function SourceValue({ source }: { source: string }) {
  const trimmed = source.trim();
  if (isUrl(trimmed)) {
    return (
      <a
        href={trimmed}
        target="_blank"
        rel="noreferrer"
        className="break-all text-sky-700 underline decoration-dotted underline-offset-2 hover:decoration-solid dark:text-sky-400"
      >
        [{trimmed}]
      </a>
    );
  }
  const embedded = trimmed.match(/https?:\/\/\S+/);
  if (embedded) {
    const before = trimmed.slice(0, embedded.index).trim();
    return (
      <span className="break-words">
        [{before}{' '}
        <a
          href={embedded[0]}
          target="_blank"
          rel="noreferrer"
          className="break-all text-sky-700 underline decoration-dotted underline-offset-2 hover:decoration-solid dark:text-sky-400"
        >
          {embedded[0]}
        </a>
        ]
      </span>
    );
  }
  return <span className="break-words">[{trimmed}]</span>;
}

const CONFIDENCE_TONE: Record<string, string> = {
  high: 'border-emerald-600/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
  medium: 'border-amber-600/40 bg-amber-500/10 text-amber-800 dark:text-amber-300',
  low: 'border-rose-600/40 bg-rose-500/10 text-rose-800 dark:text-rose-300',
};

export function ConfidencePill({ confidence }: { confidence: string }) {
  const tone =
    CONFIDENCE_TONE[confidence.toLowerCase()] ??
    'border-neutral-500/40 bg-neutral-500/10 text-neutral-700 dark:text-neutral-300';
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium tracking-wide ${tone}`}>
      {confidence}
    </span>
  );
}

/** One row of the key = value ledger. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="text-neutral-500 dark:text-neutral-400">{label}</span>
      <span className="text-neutral-400 dark:text-neutral-600">=</span>
      <span className="min-w-0 flex-1 text-neutral-900 dark:text-neutral-100">{children}</span>
    </div>
  );
}

export interface CitedValueProps {
  /** Field name as the user should read it, for example "Slope percent". */
  label: string;
  /** Already formatted for display. */
  value: ReactNode;
  source: string;
  fetchedAt: string;
  confidence?: string;
  /** Optional one line explanation of what the number means for an appeal. */
  note?: string;
}

/**
 * A single fact plus everything needed to audit it. Source and fetchedAt are
 * required by the type, not optional, on purpose.
 */
export function CitedValue({ label, value, source, fetchedAt, confidence, note }: CitedValueProps) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white/60 p-3 font-mono text-[13px] leading-relaxed dark:border-neutral-800 dark:bg-neutral-900/40">
      <Row label={label.toLowerCase()}>
        <span className="font-semibold">{value}</span>
      </Row>
      <Row label="source">
        <SourceValue source={source} />
      </Row>
      <Row label="fetched">
        <span className="text-neutral-700 dark:text-neutral-300">{fetchedAt}</span>
      </Row>
      {confidence ? (
        <Row label="confidence">
          <ConfidencePill confidence={confidence} />
        </Row>
      ) : null}
      {note ? (
        <p className="mt-2 border-t border-neutral-200 pt-2 font-sans text-xs text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
          {note}
        </p>
      ) : null}
    </div>
  );
}

/** Card shell with the live capture badge, matching the Mireye treatment. */
export function CitationCard({
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
    <section className="rounded-lg border border-neutral-200 bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-950/60">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          {title}
        </h2>
        {capturedAt ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-800 dark:text-emerald-300">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            live · captured {capturedAt}
          </span>
        ) : null}
      </header>
      {subtitle ? (
        <p className="mb-3 text-xs text-neutral-600 dark:text-neutral-400">{subtitle}</p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </section>
  );
}
