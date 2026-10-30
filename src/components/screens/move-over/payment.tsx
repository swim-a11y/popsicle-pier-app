"use client";

import { useState } from "react";

import { PaymentChoices } from "@/components/screens/sign-up/payment";
import { Done, Problem } from "@/components/screens/sign-up/shared";
import { Button } from "@/components/ui/button";
import { NOTHING_CHARGED_TODAY } from "@/content/sign-up";
import { emptyDraft } from "@/rules/sign-up";
import { paymentProblem } from "@/rules/booking";
import { familyLessons } from "@/rules/family";
import { money } from "@/rules/prices";

import { MoveOverScreen, useMoveOver } from "./shared";

export function MoveOverPayment() {
  const step = useMoveOver("payment");
  const [problem, setProblem] = useState<string | null>(null);
  if (step === null || step === "none") return <MoveOverScreen stepKey="payment" step={step} title="How you'll pay" />;
  const { family, loaded, draft } = step;
  const payment = draft?.payment ?? emptyDraft("x", "").payment;
  const lessons = familyLessons(loaded.data, family.id).filter((l) => l.bankCents !== null);
  const prices = (method: "bank" | "card") =>
    lessons.map((l) => ({ name: l.child.firstName, amount: `${money(method === "bank" ? l.bankCents! : (l.cardCents ?? l.bankCents!))} a lesson` }));

  return (
    <MoveOverScreen stepKey="payment" step={step} title="How you'll pay">
      <Done>{NOTHING_CHARGED_TODAY}</Done>
      <p>Bank details don&apos;t move to the new app, so please link your bank again.</p>
      <PaymentChoices
        payment={payment}
        setPayment={(p) => {
          setProblem(null);
          void step.save((d) => ({ ...d, payment: p }));
        }}
        bankPrices={prices("bank")}
        cardPrices={prices("card")}
        problem={problem}
      />
      <Problem>{problem}</Problem>
      <Button
        size="block"
        onClick={() => {
          const found = paymentProblem(payment, { hasClass: true, hasEval: false }, false);
          setProblem(found);
          if (!found) step.next();
        }}
      >
        Continue
      </Button>
    </MoveOverScreen>
  );
}
