/**
 * The left column card shell.
 *
 * Three of these carry the whole argument: what the insurer said, what the
 * record shows, what to do about it. Numbering them is not decoration, it is
 * the reading order, so a card that is not part of that sequence should not use
 * this component.
 */

import type { ReactNode } from 'react';

export function StepCard({
  step,
  title,
  subtitle,
  children,
}: {
  step: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    // min-w-0 throughout: citation rows use truncate, which is white-space
    // nowrap, so their min-content width is the full untruncated source string.
    // Without an explicit zero minimum that propagates all the way up, a long
    // dataset URL widens the whole page instead of ellipsing.
    <section className="min-w-0 border border-rule bg-white/45 p-5 sm:p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-amber">Step {step}</p>
      <h2 className="mt-2 font-serif text-xl leading-snug font-normal text-ink sm:text-2xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">{subtitle}</p>
      ) : null}
      <div className="mt-5 min-w-0">{children}</div>
    </section>
  );
}

/** Small bordered tag used for the header eyebrows and inline labels. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-[2px] border border-rule px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
      {children}
    </span>
  );
}
