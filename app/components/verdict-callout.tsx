/**
 * The verdict, in the top right slot, in the largest type on the page.
 *
 * Four states, one hue. They are separated by an intensity ladder rather than
 * by color, so the page never turns into a status dashboard: filled and heavy
 * for a mismatch, filled and light for a two sided answer, outlined for a
 * supported claim, neutral grey rule for no verdict at all.
 *
 * 'partial' exists because flattening a two sided answer is the specific way
 * this tool would mislead someone. The statement stays deliberately short and
 * the two sided detail goes in the context line underneath: whoever reads only
 * the big words must not come away with the wrong half of the answer.
 *
 * 'withheld' is not a failure state to hide. It means the reasoning step could
 * not be verified, and saying so is more useful than an unverified conclusion
 * in the most prominent position on the page.
 */

export type VerdictState = 'mismatch' | 'partial' | 'supported' | 'withheld';

const STATEMENT: Record<VerdictState, string> = {
  mismatch: 'Mismatch found',
  partial: 'Partially supported',
  supported: 'Claim supported',
  withheld: 'No verdict yet',
};

const TREATMENT: Record<VerdictState, string> = {
  mismatch: 'border-2 border-amber bg-amber-tint',
  partial: 'border border-amber bg-amber-tint',
  supported: 'border border-amber bg-transparent',
  withheld: 'border border-rule bg-transparent',
};

export function VerdictCallout({ state, context }: { state: VerdictState; context: string }) {
  return (
    <div
      className={`animate-[--animate-verdict-in] rounded-[2px] p-4 sm:p-5 ${TREATMENT[state]}`}
    >
      <p
        className={`font-mono text-[10px] uppercase tracking-[0.18em] ${
          state === 'withheld' ? 'text-ink-muted' : 'text-amber'
        }`}
      >
        Parcel finding
      </p>
      <p className="mt-2 font-serif text-2xl leading-tight font-normal text-ink sm:text-[1.75rem]">
        {STATEMENT[state]}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{context}</p>
    </div>
  );
}
