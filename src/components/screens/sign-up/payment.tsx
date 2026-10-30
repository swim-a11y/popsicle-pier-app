"use client";

import { CheckIcon, CreditCardIcon, LandmarkIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Tag } from "@/components/parts/tag";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { evaluationAsksForCard } from "@/config";
import { BANK_DRAFT_BOX, BANK_DRAFT_COPY_LINE, bankDraftLines } from "@/content/payment";
import { BACKUP_CARD_LINE, EVALUATION_NEVER_CHARGED, NOTHING_CHARGED_TODAY } from "@/content/sign-up";
import type { AppData, SignUpDraft } from "@/data/types";
import { cn } from "@/lib/utils";
import { bookingKinds, paymentProblem } from "@/rules/booking";
import { money, cardPriceCents } from "@/rules/prices";

import { Done, NeedsEarlierStep, Problem, StepScreen, StepTitle, useSignUpStep } from "./shared";

type Payment = SignUpDraft["payment"];

/** Each child's price a lesson, for bank draft or card. */
function childPrices(data: Readonly<AppData>, draft: SignUpDraft, method: "bank" | "card"): { name: string; amount: string }[] {
  return draft.children.flatMap((c) => {
    if (c.booking?.kind !== "class") return [];
    const cls = data.classes.find((x) => x.id === c.booking!.timeId);
    const lt = cls && data.lessonTypes.find((l) => l.id === cls.lessonTypeId);
    if (!lt) return [];
    const cents = method === "bank" ? lt.bankDraftCents : cardPriceCents(lt.bankDraftCents);
    return [{ name: c.firstName, amount: `${money(cents)} a lesson` }];
  });
}

/** Bank draft or card: one tap each, with the price showing before the choice. No number boxes. */
export function PaymentChoices({
  payment,
  setPayment,
  bankPrices,
  cardPrices,
  problem,
  schoolEmail,
}: {
  schoolEmail: string;
  payment: Payment;
  setPayment: (p: Payment) => void;
  bankPrices: { name: string; amount: string }[];
  cardPrices: { name: string; amount: string }[];
  problem: string | null;
}) {
  const option = (method: "bank" | "card", title: string, icon: ReactNode, prices: { name: string; amount: string }[], extra?: ReactNode) => {
    const selected = payment.main === method;
    return (
      <button
        type="button"
        aria-pressed={selected ? true : undefined}
        onClick={() => setPayment({ ...payment, main: method })}
        className={cn(
          "flex w-full flex-col items-start gap-2 rounded-card border-2 bg-surface px-4 py-4 text-left shadow-card",
          selected ? "border-primary" : "border-transparent",
        )}
      >
        <span className="flex w-full items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-heading text-big text-heading">
            {icon}
            {title}
          </span>
          <span className="flex items-center gap-2">
            {extra}
            {selected ? <CheckIcon className="size-6 text-primary" aria-hidden /> : null}
          </span>
        </span>
        {prices.map((p) => (
          <span key={p.name} className="block">
            {prices.length > 1 ? `${p.name}: ` : ""}
            <span className="font-strong">{p.amount}</span>
          </span>
        ))}
        <span className="block">{method === "bank" ? "Link a sample bank with one tap." : "Use a sample card with one tap."}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {option("bank", "Bank draft", <LandmarkIcon className="size-6" aria-hidden />, bankPrices, <Tag tone="highlight">Preferred</Tag>)}
      {option("card", "Card", <CreditCardIcon className="size-6" aria-hidden />, cardPrices)}
      {payment.main === "bank" ? (
        <section className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card" aria-labelledby="authorization-title">
          <h2 id="authorization-title" className="font-heading text-body text-heading">
            Bank draft authorization
          </h2>
          <ul className="flex flex-col gap-1">
            {bankDraftLines(schoolEmail).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className="flex min-h-tap items-center gap-3">
            <Checkbox
              id="authorize"
              checked={payment.authorized}
              aria-invalid={problem?.includes("authorize") ? true : undefined}
              onCheckedChange={(v) => setPayment({ ...payment, authorized: v === true })}
            />
            <Label htmlFor="authorize">{BANK_DRAFT_BOX}</Label>
          </div>
          <p>{BANK_DRAFT_COPY_LINE}</p>
          <div className="flex flex-col gap-2 border-t-2 border-line pt-4">
            <p className="font-strong text-heading">A backup card is needed with bank draft.</p>
            <p>{BACKUP_CARD_LINE}</p>
            {payment.backupCard ? (
              <Done>Backup card added (sample)</Done>
            ) : (
              <Button variant="secondary" size="block" onClick={() => setPayment({ ...payment, backupCard: true })}>
                <CreditCardIcon className="size-5" aria-hidden /> Add a backup card (sample)
              </Button>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function PaymentStep() {
  const step = useSignUpStep("payment");
  const [problem, setProblem] = useState<string | null>(null);
  if (!step) return <StepScreen step={step} stepKey="payment">{null}</StepScreen>;
  const draft = step.draft;
  const kinds = draft ? bookingKinds(draft) : { hasClass: false, hasEval: false };

  if (!draft || (!kinds.hasClass && !kinds.hasEval)) {
    return (
      <StepScreen step={step} stepKey="payment" showStep={false}>
        <StepTitle>How you&apos;ll pay</StepTitle>
        <NeedsEarlierStep step={step} message="Pick a time for your swimmer first. Then you'll see the price here." href="/sign-up/times?child=1" label="Pick a time" />
      </StepScreen>
    );
  }

  const setPayment = (payment: Payment) => {
    setProblem(null);
    void step.save((d) => ({ ...d, payment }));
  };
  const onContinue = () => {
    const found = paymentProblem(draft.payment, kinds, evaluationAsksForCard);
    setProblem(found);
    if (!found) void step.advance();
  };

  return (
    <StepScreen step={step} stepKey="payment">
      <StepTitle>How you&apos;ll pay</StepTitle>
      <Done>{NOTHING_CHARGED_TODAY}</Done>
      {kinds.hasClass ? (
        <>
          <PaymentChoices
            schoolEmail={step.loaded.data.pools.find((p) => p.id === draft.poolId)?.schoolEmail ?? ""}
            payment={draft.payment}
            setPayment={setPayment}
            bankPrices={childPrices(step.loaded.data, draft, "bank")}
            cardPrices={childPrices(step.loaded.data, draft, "card")}
            problem={problem}
          />
          {kinds.hasEval ? <p>{EVALUATION_NEVER_CHARGED}</p> : null}
        </>
      ) : (
        <section className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card">
          <p className="font-heading text-big text-heading">{EVALUATION_NEVER_CHARGED}</p>
          {evaluationAsksForCard ? (
            <>
              <p>We ask for a card to hold the spot. It isn&apos;t charged for the free evaluation.</p>
              {draft.payment.holdCard ? (
                <Done>Card added to hold the spot (sample)</Done>
              ) : (
                <Button variant="secondary" size="block" onClick={() => setPayment({ ...draft.payment, holdCard: true })}>
                  <CreditCardIcon className="size-5" aria-hidden /> Add a card to hold the spot (sample)
                </Button>
              )}
            </>
          ) : null}
        </section>
      )}
      <Problem>{problem}</Problem>
      <Button size="block" onClick={onContinue}>
        Continue
      </Button>
    </StepScreen>
  );
}
