import { priceLines } from "@/rules/prices";

/** Both prices a lesson, bank draft first, in two rows that read at a glance. */
export function PriceRows({ bankCents, testId }: { bankCents: number; testId?: string }) {
  return (
    <span className="mt-1 grid grid-cols-[auto_1fr] gap-x-4" data-testid={testId}>
      {priceLines(bankCents).map((p) => (
        <span key={p.method} className="contents">
          <span className="font-strong">{p.label}</span>
          <span>{p.amount}&nbsp;a&nbsp;lesson</span>
        </span>
      ))}
    </span>
  );
}
