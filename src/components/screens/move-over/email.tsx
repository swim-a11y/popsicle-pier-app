"use client";

import { useState } from "react";

import { Done, Problem } from "@/components/screens/sign-up/shared";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { codeMatches } from "@/rules/sign-up";
import { SAMPLE_CODE } from "@/sandbox/sample-code";

import { MoveOverScreen, useMoveOver } from "./shared";

export function MoveOverEmail() {
  const step = useMoveOver("email");
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  if (step === null || step === "none") return <MoveOverScreen stepKey="email" step={step} title="Confirm your email" />;
  const { family, draft } = step;
  const confirmed = draft?.confirmedEmail === family.email;
  const sent = Boolean(draft?.codeSent);

  const onCode = (value: string) => {
    const next = value.replace(/\D/g, "").slice(0, 6);
    setCode(next);
    if (next.length < 6) return setProblem(null);
    if (codeMatches(next, SAMPLE_CODE)) {
      setProblem(null);
      void step.save((d) => ({ ...d, code: next, codeSent: true, email: family.email, confirmedEmail: family.email }));
    } else {
      setProblem("That code doesn't match. Check the sample code above and try again.");
    }
  };

  return (
    <MoveOverScreen stepKey="email" step={step} title="Confirm your email">
      <p>
        We have <span className="font-strong">{family.email}</span>. Confirm it once with a code.
      </p>
      {confirmed ? (
        <>
          <Done>Email confirmed: {family.email}</Done>
          <Button size="block" onClick={step.next}>
            Continue
          </Button>
        </>
      ) : sent ? (
        <section className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card">
          <p>The real app would email a 6-digit code. This sample shows it here instead.</p>
          <p className="rounded-control bg-success px-4 py-3 font-strong" data-testid="sample-code">
            Sample code: {SAMPLE_CODE}
          </p>
          <Field>
            <FieldLabel htmlFor="move-code">6-digit code</FieldLabel>
            <Input id="move-code" name="one-time-code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={code} aria-invalid={problem ? true : undefined} onChange={(e) => onCode(e.target.value)} />
            <Problem>{problem}</Problem>
          </Field>
        </section>
      ) : (
        <Button size="block" onClick={() => void step.save((d) => ({ ...d, email: family.email, codeSent: true }))}>
          Send my code
        </Button>
      )}
    </MoveOverScreen>
  );
}
