"use client";

import { useState } from "react";

import { Problem } from "@/components/screens/sign-up/shared";
import { PageTitle } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SWIM_DIAPER_LINE } from "@/content/sign-up";
import type { AddDraft } from "@/data/types";
import { birthDateProblem, nameProblem } from "@/rules/sign-up";

import { AddScreen, useAddStep, type AddStep } from "./shared";

type Fields = { firstName: string; birthMonth: string; birthDay: string; birthYear: string };

/** A changed birth date clears any time picked for the old one. */
function withTyped(d: AddDraft, f: Fields): AddDraft {
  const changed = d.kid.birthMonth !== f.birthMonth || d.kid.birthDay !== f.birthDay || d.kid.birthYear !== f.birthYear;
  return { ...d, kid: changed ? { ...d.kid, ...f, booking: null, waitlistClassIds: [] } : { ...d.kid, ...f } };
}

export function AddChildStep() {
  const step = useAddStep("child");
  if (typeof step !== "object") return <AddScreen stepKey="child" step={step} />;
  return <AddChildForm step={step} />;
}

/** Starts from what's saved; typing stays local until Continue or leaving a field. */
function AddChildForm({ step }: { step: AddStep }) {
  const [f, setF] = useState<Fields>(() => {
    const { firstName, birthMonth, birthDay, birthYear } = step.draft.kid;
    return { firstName, birthMonth, birthDay, birthYear };
  });
  const [problems, setProblems] = useState<{ name?: string | null; birth?: string | null }>({});

  const save = () => void step.save((d) => withTyped(d, f));
  const onContinue = () => {
    const found = { name: nameProblem(f.firstName), birth: birthDateProblem(f, step.loaded.today) };
    setProblems(found);
    if (found.name || found.birth) {
      document.getElementById(found.name ? "add-name" : "add-month")?.focus();
      return;
    }
    void step.advance((d) => withTyped(d, { ...f, firstName: f.firstName.trim() }));
  };

  return (
    <AddScreen stepKey="child" step={step}>
      <PageTitle>A brother or sister</PageTitle>
      <div className="flex flex-col gap-4 rounded-card bg-surface p-5 shadow-card">
        <Field>
          <FieldLabel htmlFor="add-name">First name</FieldLabel>
          <Input id="add-name" name="new-swimmer-first-name" value={f.firstName} aria-invalid={problems.name ? true : undefined} onChange={(e) => setF({ ...f, firstName: e.target.value })} onBlur={save} />
          <Problem>{problems.name}</Problem>
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-strong">Birth date</legend>
          <div className="flex gap-3">
            {(
              [
                ["add-month", "Month", "birthMonth", 2, "w-20"],
                ["add-day", "Day", "birthDay", 2, "w-20"],
                ["add-year", "Year", "birthYear", 4, "w-28"],
              ] as const
            ).map(([id, label, key, max, width]) => (
              <div key={id} className="flex flex-col gap-1">
                <label htmlFor={id}>{label}</label>
                <Input
                  id={id}
                  name={`new-swimmer-${key}`}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={max}
                  className={width}
                  value={f[key]}
                  aria-invalid={problems.birth ? true : undefined}
                  onChange={(e) => setF({ ...f, [key]: e.target.value.replace(/\D/g, "") })}
                  onBlur={save}
                />
              </div>
            ))}
          </div>
          <Problem>{problems.birth}</Problem>
        </fieldset>
      </div>
      <p className="rounded-card bg-surface px-4 py-3 shadow-card">{SWIM_DIAPER_LINE}</p>
      <Button size="block" onClick={onContinue}>
        Continue
      </Button>
    </AddScreen>
  );
}
