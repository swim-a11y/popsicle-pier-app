"use client";

import { useState } from "react";

import { PinnedBar } from "@/components/parts/pinned-bar";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SWIM_DIAPER_LINE } from "@/content/sign-up";
import { newId } from "@/data/ids";
import type { DraftChild, SignUpDraft } from "@/data/types";
import { birthDateProblem, emptyDraftChild, nameProblem } from "@/rules/sign-up";

import { Problem, StepScreen, StepTitle, useDraftFields, useSignUpStep } from "./shared";

type Kid = Pick<DraftChild, "key" | "firstName" | "birthMonth" | "birthDay" | "birthYear">;

const pick = (d: SignUpDraft | null): Kid[] =>
  d && d.children.length > 0
    ? d.children.map(({ key, firstName, birthMonth, birthDay, birthYear }) => ({ key, firstName, birthMonth, birthDay, birthYear }))
    : [{ key: "first-swimmer", firstName: "", birthMonth: "", birthDay: "", birthYear: "" }];

/** Puts the typed swimmers back into the draft, keeping each one's stage and time. */
function merge(d: SignUpDraft, kids: Kid[]): SignUpDraft {
  return {
    ...d,
    children: kids.map((k) => {
      const existing = d.children.find((c) => c.key === k.key) ?? emptyDraftChild(k.key);
      const birthChanged = existing.birthMonth !== k.birthMonth || existing.birthDay !== k.birthDay || existing.birthYear !== k.birthYear;
      return birthChanged ? { ...existing, ...k, booking: null, waitlistClassIds: [] } : { ...existing, ...k };
    }),
  };
}

export function SwimmersStep() {
  const step = useSignUpStep("swimmers");
  const [kids, setKids] = useDraftFields(step, pick);
  const [problems, setProblems] = useState<Record<string, { name?: string | null; birth?: string | null }>>({});

  if (!step) return <StepScreen step={step} stepKey="swimmers">{null}</StepScreen>;
  const today = step.loaded.today;
  const update = (key: string, patch: Partial<Kid>) => setKids((list) => list.map((k) => (k.key === key ? { ...k, ...patch } : k)));
  const saveTyped = () => void step.save((d) => merge(d, kids));

  const onContinue = () => {
    const found: typeof problems = {};
    for (const k of kids) {
      const name = nameProblem(k.firstName);
      const birth = birthDateProblem(k, today);
      if (name || birth) found[k.key] = { name, birth };
    }
    setProblems(found);
    if (Object.keys(found).length > 0) {
      const first = kids.find((k) => found[k.key]);
      // Bring that swimmer's box up under the banner, so its messages show above the pinned bar, then focus the field.
      document.getElementById(`${first?.key}-title`)?.closest('[role="group"]')?.scrollIntoView?.({ block: "start" });
      document.getElementById(`${first?.key}-${found[first!.key].name ? "name" : "month"}`)?.focus({ preventScroll: true });
      return;
    }
    void step.advance((d) => merge(d, kids.map((k) => ({ ...k, firstName: k.firstName.trim() }))));
  };

  return (
    <StepScreen step={step} stepKey="swimmers" pinned>
      <StepTitle>Your swimmers</StepTitle>
      {kids.map((kid, i) => {
        const p = problems[kid.key] ?? {};
        return (
          <div key={kid.key} role="group" aria-labelledby={`${kid.key}-title`} className="flex flex-col gap-4 rounded-card bg-surface p-5 shadow-card">
            <h2 id={`${kid.key}-title`} className={kids.length === 1 ? "sr-only" : "font-heading text-body text-heading"}>
              {kids.length > 1 ? `Swimmer ${i + 1}` : "Your swimmer"}
            </h2>
            <Field>
              <FieldLabel htmlFor={`${kid.key}-name`}>First name</FieldLabel>
              <Input
                id={`${kid.key}-name`}
                name={`${kid.key}-first-name`}
                value={kid.firstName}
                aria-invalid={p.name ? true : undefined}
                aria-describedby={p.name ? `${kid.key}-name-problem` : undefined}
                onChange={(e) => update(kid.key, { firstName: e.target.value })}
                onBlur={saveTyped}
              />
              <Problem id={`${kid.key}-name-problem`}>{p.name}</Problem>
            </Field>
            <fieldset className="flex flex-col gap-2" aria-describedby={p.birth ? `${kid.key}-birth-problem` : undefined}>
              <legend className="mb-2 font-strong">Birth date</legend>
              <div className="flex gap-3">
                {(
                  [
                    ["month", "Month", "birthMonth", 2, "w-20"],
                    ["day", "Day", "birthDay", 2, "w-20"],
                    ["year", "Year", "birthYear", 4, "w-28"],
                  ] as const
                ).map(([idPart, label, field, max, width]) => (
                  <div key={idPart} className="flex flex-col gap-1">
                    <label htmlFor={`${kid.key}-${idPart}`}>{label}</label>
                    <Input
                      id={`${kid.key}-${idPart}`}
                      name={`${kid.key}-birth-${idPart}`}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={max}
                      className={width}
                      value={kid[field]}
                      aria-invalid={p.birth ? true : undefined}
                      onChange={(e) => update(kid.key, { [field]: e.target.value.replace(/\D/g, "") })}
                      onBlur={saveTyped}
                    />
                  </div>
                ))}
              </div>
              <Problem id={`${kid.key}-birth-problem`}>{p.birth}</Problem>
            </fieldset>
            {kids.length > 1 ? (
              <Button
                variant="quiet"
                size="small"
                className="self-start"
                onClick={() => {
                  const next = kids.filter((k) => k.key !== kid.key);
                  setKids(next);
                  void step.save((d) => ({ ...merge(d, next) }));
                }}
              >
                Remove {kid.firstName.trim() || "this swimmer"}
              </Button>
            ) : null}
          </div>
        );
      })}
      <Button variant="secondary" onClick={() => setKids((list) => [...list, { key: newId(), firstName: "", birthMonth: "", birthDay: "", birthYear: "" }])}>
        Add another swimmer
      </Button>
      <p className="rounded-card bg-surface px-4 py-3 shadow-card">{SWIM_DIAPER_LINE}</p>
      {/* Continue stays in reach on the first screen of a phone, above the boxes still to scroll past. */}
      <PinnedBar testId="continue-bar">
        <Button size="block" onClick={onContinue}>
          Continue
        </Button>
      </PinnedBar>
    </StepScreen>
  );
}
