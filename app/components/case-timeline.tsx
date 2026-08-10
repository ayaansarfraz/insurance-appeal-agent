/**
 * The agent's actual path, as a dot timeline.
 *
 * Every dot is read from the tool calls the agent really made, not from a
 * hardcoded happy path. A hollow dot means that step did not happen for this
 * parcel, which is information: no letter step on a parcel where the insurer
 * turned out to be right is the product working, not the product failing.
 *
 * Tool names here must match the tool definitions in lib/agent.ts. If a tool is
 * renamed there, this silently goes hollow, so grep for the name before
 * changing it.
 */

import type { AppealResponse } from '@/lib/types';

interface Step {
  label: string;
  done: boolean;
  detail?: string;
}

function letterStep(result: AppealResponse): Step {
  if (result.letter) return { label: 'Appeal letter drafted', done: true };
  if (result.letterWithheldReason) {
    return { label: 'Letter withheld', done: false, detail: 'citations could not be verified' };
  }
  return { label: 'No letter warranted', done: false, detail: 'nothing here to appeal' };
}

export function buildSteps(result: AppealResponse): Step[] {
  const calls = result.toolCalls ?? [];
  const called = (name: string) => calls.includes(name);
  const presets = result.presetsChosen ?? [];

  return [
    { label: 'Notice received', done: true, detail: 'address and stated reason' },
    {
      label: 'Parcel geocoded',
      done: called('mireye_geocode'),
      detail: `${result.parcel.coordinates.lat.toFixed(4)}, ${result.parcel.coordinates.lng.toFixed(4)}`,
    },
    {
      label: 'Hazard fields fetched',
      done: called('mireye_fetch_fields'),
      // The agent choosing its own evidence is a claim this project makes.
      // Naming the presets it picked is the evidence for it.
      detail: presets.length > 0 ? presets.join(', ') : undefined,
    },
    {
      label: 'Fire history checked',
      done: called('fire_perimeter_history') || called('fires_within_radius'),
      detail: 'CAL FIRE perimeters',
    },
    { label: 'Reconciled', done: called('submit_reconciliation') },
    letterStep(result),
  ];
}

export function CaseTimeline({ result }: { result: AppealResponse }) {
  const steps = buildSteps(result);

  return (
    <section className="border border-rule bg-white/45 p-5">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-amber">Case timeline</h2>
      <ol className="mt-4">
        {steps.map((step, i) => (
          <li key={step.label} className="relative flex gap-3 pb-4 last:pb-0">
            {/* Connector, drawn behind the dot and stopped short on the last row. */}
            {i < steps.length - 1 ? (
              <span aria-hidden className="absolute top-2.5 left-[3.5px] h-full w-px bg-rule" />
            ) : null}
            <span
              aria-hidden
              className={`relative mt-[5px] h-2 w-2 shrink-0 rounded-full border ${
                step.done ? 'border-amber bg-amber' : 'border-rule bg-paper'
              }`}
            />
            <div className="min-w-0">
              <p className={`text-[13px] leading-snug ${step.done ? 'text-ink' : 'text-ink-muted'}`}>
                {step.label}
                {/* State is carried by more than dot shape, for screen readers
                    and for anyone who cannot separate filled from hollow. */}
                <span className="sr-only">{step.done ? ' (completed)' : ' (not applicable)'}</span>
              </p>
              {step.detail ? (
                <p className="mt-0.5 truncate font-mono text-[11px] text-ink-muted">{step.detail}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
