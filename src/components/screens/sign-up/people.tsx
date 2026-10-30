"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { newId } from "@/data/ids";
import type { SignUpDraft } from "@/data/types";
import { emailProblem, nameProblem, phoneProblem } from "@/rules/sign-up";

import { Problem, StepScreen, StepTitle, useDraftFields, useSignUpStep } from "./shared";

type Fields = { contacts: { name: string; phone: string }[]; adults: { key: string; name: string; email: string }[] };
const pick = (d: SignUpDraft | null): Fields => ({
  contacts: [0, 1].map((i) => ({ name: d?.contacts[i]?.name ?? "", phone: d?.contacts[i]?.phone ?? "" })),
  adults: d?.messageAdults ?? [],
});

export function PeopleStep() {
  const step = useSignUpStep("people");
  const [f, setF] = useDraftFields(step, pick);
  const [adding, setAdding] = useState({ name: "", email: "" });
  const [problems, setProblems] = useState<Record<string, string | null>>({});
  if (!step) return <StepScreen step={step} stepKey="people">{null}</StepScreen>;

  const withTyped = (d: SignUpDraft): SignUpDraft => ({ ...d, contacts: f.contacts, messageAdults: f.adults });
  const saveTyped = () => void step.save(withTyped);
  const setContact = (i: number, patch: Partial<{ name: string; phone: string }>) =>
    setF((x) => ({ ...x, contacts: x.contacts.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  const addAdult = () => {
    const found = { "adult-name": nameProblem(adding.name, "a name"), "adult-email": emailProblem(adding.email) };
    setProblems((p) => ({ ...p, ...found }));
    if (found["adult-name"] || found["adult-email"]) return;
    const adults = [...f.adults, { key: newId(), name: adding.name.trim(), email: adding.email.trim() }];
    setF((x) => ({ ...x, adults }));
    setAdding({ name: "", email: "" });
    void step.save((d) => ({ ...d, contacts: f.contacts, messageAdults: adults }));
  };

  const onContinue = () => {
    const found: Record<string, string | null> = {};
    f.contacts.forEach((c, i) => {
      found[`c${i}-name`] = nameProblem(c.name, "a name");
      found[`c${i}-phone`] = phoneProblem(c.phone);
    });
    setProblems(found);
    const first = Object.entries(found).find(([, v]) => v);
    if (first) {
      document.getElementById(first[0])?.focus();
      return;
    }
    void step.advance((d) => ({ ...withTyped(d), peopleDone: true }));
  };

  return (
    <StepScreen step={step} stepKey="people">
      <StepTitle>Your people</StepTitle>
      <section className="flex flex-col gap-4" aria-labelledby="contacts-title">
        <div className="flex flex-col gap-1">
          <h2 id="contacts-title" className="font-heading text-body text-heading">
            Two emergency contacts
          </h2>
          <p>People we can call if we can&apos;t reach you. Made-up numbers with 555, please.</p>
        </div>
        {f.contacts.map((c, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card">
            <Field>
              <FieldLabel htmlFor={`c${i}-name`}>Contact {i + 1} name</FieldLabel>
              <Input id={`c${i}-name`} name={`contact-${i + 1}-name`} value={c.name} aria-invalid={problems[`c${i}-name`] ? true : undefined} onChange={(e) => setContact(i, { name: e.target.value })} onBlur={saveTyped} />
              <Problem>{problems[`c${i}-name`]}</Problem>
            </Field>
            <Field>
              <FieldLabel htmlFor={`c${i}-phone`}>Contact {i + 1} phone</FieldLabel>
              <Input
                id={`c${i}-phone`}
                name={`contact-${i + 1}-phone`}
                type="tel"
                inputMode="tel"
                value={c.phone}
                aria-invalid={problems[`c${i}-phone`] ? true : undefined}
                onChange={(e) => setContact(i, { phone: e.target.value })}
                onBlur={saveTyped}
              />
              <Problem>{problems[`c${i}-phone`]}</Problem>
            </Field>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="messages-title">
        <div className="flex flex-col gap-1">
          <h2 id="messages-title" className="font-heading text-body text-heading">
            Anyone else who should get our messages?
          </h2>
          <p>Up to two adults. They get our emails and nothing else.</p>
        </div>
        {f.adults.map((a) => (
          <div key={a.key} className="flex items-center justify-between gap-3 rounded-card bg-surface px-4 py-3 shadow-card">
            <span>
              <span className="block font-strong">{a.name}</span>
              <span className="block">{a.email}</span>
            </span>
            <Button
              variant="quiet"
              size="small"
              onClick={() => {
                const adults = f.adults.filter((x) => x.key !== a.key);
                setF((x) => ({ ...x, adults }));
                void step.save((d) => ({ ...d, messageAdults: adults }));
              }}
            >
              Remove
            </Button>
          </div>
        ))}
        {f.adults.length < 2 ? (
          <div className="flex flex-col gap-3 rounded-card border-2 border-dashed border-line p-5">
            <Field>
              <FieldLabel htmlFor="adult-name">Their name</FieldLabel>
              <Input id="adult-name" name="message-adult-name" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} />
              <Problem>{problems["adult-name"]}</Problem>
            </Field>
            <Field>
              <FieldLabel htmlFor="adult-email">Their email</FieldLabel>
              <Input id="adult-email" name="message-adult-email" type="email" inputMode="email" value={adding.email} onChange={(e) => setAdding({ ...adding, email: e.target.value })} />
              <Problem>{problems["adult-email"]}</Problem>
            </Field>
            <Button variant="secondary" size="block" onClick={addAdult}>
              Add this adult
            </Button>
          </div>
        ) : null}
      </section>

      <Button size="block" onClick={onContinue}>
        {f.adults.length > 0 ? "Continue" : "Skip and continue"}
      </Button>
    </StepScreen>
  );
}
