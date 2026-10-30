"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { HEARD_FROM } from "@/content/sign-up";
import type { SignUpDraft } from "@/data/types";
import { codeMatches, emailProblem, nameProblem, phoneProblem } from "@/rules/sign-up";
import { SAMPLE_CODE } from "@/sandbox/sample-code";

import { ChoiceButton, Done, Problem, StepScreen, StepTitle, useDraftFields, useSignUpStep } from "./shared";

type Fields = { fullName: string; email: string; phone: string; code: string };
const pick = (d: SignUpDraft | null): Fields => ({ fullName: d?.fullName ?? "", email: d?.email ?? "", phone: d?.phone ?? "", code: d?.code ?? "" });

export function YouStep() {
  const step = useSignUpStep("you");
  const [f, setF] = useDraftFields(step, pick);
  const [problems, setProblems] = useState<Partial<Record<keyof Fields | "heard", string | null>>>({});
  if (!step) return <StepScreen step={step} stepKey="you">{null}</StepScreen>;

  const draft = step.draft;
  const email = f.email.trim();
  const confirmed = Boolean(draft?.confirmedEmail && draft.confirmedEmail === email);
  const codeSent = Boolean(draft?.codeSent && draft.email.trim() === email);
  // Keep a changed email from carrying an old confirmation.
  const withTyped = (d: SignUpDraft): SignUpDraft => ({
    ...d,
    ...f,
    confirmedEmail: d.confirmedEmail === f.email.trim() ? d.confirmedEmail : null,
    codeSent: d.codeSent && d.email.trim() === f.email.trim(),
  });
  const saveTyped = () => void step.save(withTyped);

  const sendCode = () => {
    const found = { fullName: nameProblem(f.fullName, "your name"), email: emailProblem(f.email), phone: phoneProblem(f.phone) };
    setProblems(found);
    if (found.fullName || found.email || found.phone) {
      document.getElementById(found.fullName ? "you-name" : found.email ? "you-email" : "you-phone")?.focus();
      return;
    }
    // The sample shows the code on screen; a code already typed (the Sandbox fill) checks itself.
    void step.save((d) => {
      const next = { ...withTyped(d), codeSent: true };
      return f.code.length === 6 && codeMatches(f.code, SAMPLE_CODE) ? { ...next, confirmedEmail: email } : next;
    });
  };

  const onCode = (value: string) => {
    const code = value.replace(/\D/g, "").slice(0, 6);
    setF((x) => ({ ...x, code }));
    if (code.length < 6) {
      setProblems((p) => ({ ...p, code: null }));
      return;
    }
    if (codeMatches(code, SAMPLE_CODE)) {
      setProblems((p) => ({ ...p, code: null }));
      void step.save((d) => ({ ...withTyped(d), code, codeSent: true, confirmedEmail: email }));
    } else {
      setProblems((p) => ({ ...p, code: "That code doesn't match. Check the sample code above and try again." }));
    }
  };

  return (
    <StepScreen step={step} stepKey="you">
      <StepTitle>About you</StepTitle>
      <div className="flex flex-col gap-5">
        <Field>
          <FieldLabel htmlFor="you-name">Your name</FieldLabel>
          <Input id="you-name" name="your-name" value={f.fullName} aria-invalid={problems.fullName ? true : undefined} onChange={(e) => setF({ ...f, fullName: e.target.value })} onBlur={saveTyped} />
          <Problem>{problems.fullName}</Problem>
        </Field>
        <Field>
          <FieldLabel htmlFor="you-email">Email</FieldLabel>
          <FieldDescription id="you-email-hint">Use a made-up email that ends in @example.com.</FieldDescription>
          <Input
            id="you-email"
            name="your-email"
            type="email"
            inputMode="email"
            aria-describedby="you-email-hint"
            value={f.email}
            aria-invalid={problems.email ? true : undefined}
            onChange={(e) => setF({ ...f, email: e.target.value })}
            onBlur={saveTyped}
          />
          <Problem>{problems.email}</Problem>
        </Field>
        <Field>
          <FieldLabel htmlFor="you-phone">Phone</FieldLabel>
          <FieldDescription id="you-phone-hint">Use a made-up number with 555 in the middle, like 404-555-0123.</FieldDescription>
          <Input
            id="you-phone"
            name="your-phone"
            type="tel"
            inputMode="tel"
            aria-describedby="you-phone-hint"
            value={f.phone}
            aria-invalid={problems.phone ? true : undefined}
            onChange={(e) => setF({ ...f, phone: e.target.value })}
            onBlur={saveTyped}
          />
          <Problem>{problems.phone}</Problem>
        </Field>
      </div>

      {!codeSent && !confirmed ? (
        <Button size="block" onClick={sendCode}>
          Send my code
        </Button>
      ) : null}

      {codeSent && !confirmed ? (
        <section className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card" aria-labelledby="code-title">
          <h2 id="code-title" className="font-heading text-body text-heading">
            Confirm your email
          </h2>
          <p>The real app would email a 6-digit code to {email}. This sample shows it here instead.</p>
          <p className="rounded-control bg-success px-4 py-3 font-strong" data-testid="sample-code">
            Sample code: {SAMPLE_CODE}
          </p>
          <Field>
            <FieldLabel htmlFor="you-code">6-digit code</FieldLabel>
            <Input
              id="you-code"
              name="one-time-code"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={f.code}
              aria-invalid={problems.code ? true : undefined}
              onChange={(e) => onCode(e.target.value)}
            />
            <Problem>{problems.code}</Problem>
          </Field>
        </section>
      ) : null}

      {confirmed ? (
        <>
          <Done>Email confirmed: {email}</Done>
          <section className="flex flex-col gap-3" aria-labelledby="heard-title">
            <h2 id="heard-title" className="font-heading text-big text-heading">
              How did you hear about us?
            </h2>
            {HEARD_FROM.map((h) => (
              <ChoiceButton key={h.id} title={h.label} selected={draft?.heardFrom === h.id} onClick={() => void step.advance((d) => ({ ...withTyped(d), heardFrom: h.id }))} />
            ))}
          </section>
        </>
      ) : null}
    </StepScreen>
  );
}
