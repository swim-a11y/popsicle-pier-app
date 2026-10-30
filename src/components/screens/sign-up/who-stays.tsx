"use client";

import { useState } from "react";

import { Tag } from "@/components/parts/tag";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { EMAIL_US_FIRST, isParentOrGuardian, RELATIONSHIPS, relationshipLabel, SIGNS_ON_PAPER, WHO_STAYS_INTRO } from "@/content/sign-up";
import { newId } from "@/data/ids";
import type { Relationship, SignUpDraft } from "@/data/types";
import { nameProblem } from "@/rules/sign-up";

import { Problem, StepScreen, StepTitle, useSignUpStep } from "./shared";

const firstWord = (name: string) => name.trim().split(/\s+/)[0] ?? "";

export function WhoStaysStep() {
  const step = useSignUpStep("who-stays");
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState<Relationship | "">("");
  const [problems, setProblems] = useState<{ name?: string | null; relationship?: string | null }>({});
  if (!step) return <StepScreen step={step} stepKey="who-stays">{null}</StepScreen>;

  const draft = step.draft;
  const listed = draft?.listedAdults ?? [];
  const pool = step.loaded.data.pools.find((p) => p.id === draft?.poolId);
  // Anyone already typed in step 6 is one tap here, never typed again.
  const known = [...(draft?.contacts ?? []).map((c) => c.name), ...(draft?.messageAdults ?? []).map((m) => m.name)]
    .map(firstWord)
    .filter((n, i, all) => n && all.indexOf(n) === i && !listed.some((a) => a.firstName === n));

  const addAdult = (firstName: string, rel: Relationship) =>
    step.save((d: SignUpDraft) => ({ ...d, justMe: false, listedAdults: [...d.listedAdults, { key: newId(), firstName, relationship: rel }] }));

  const addTyped = () => {
    const found = { name: nameProblem(name, "their first name"), relationship: relationship ? null : "Pick how they're related to your swimmer." };
    setProblems(found);
    if (found.name || found.relationship) return;
    void addAdult(name.trim(), relationship as Relationship);
    setName("");
    setRelationship("");
  };

  return (
    <StepScreen step={step} stepKey="who-stays">
      <StepTitle>Who stays at the pool</StepTitle>
      <p className="rounded-card bg-surface px-4 py-3 shadow-card">{WHO_STAYS_INTRO}</p>

      {listed.length > 0 ? (
        <section className="flex flex-col gap-3" aria-label="Adults you listed">
          {listed.map((a) => (
            <div key={a.key} className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-card" data-testid="listed-adult">
              <div className="flex items-center justify-between gap-2">
                <span className="font-strong text-heading">
                  {a.firstName}, {relationshipLabel(a.relationship).toLowerCase()}
                </span>
                <Tag tone="plain">Waiting</Tag>
              </div>
              <p>{SIGNS_ON_PAPER}</p>
              {!isParentOrGuardian(a.relationship) ? (
                <div className="flex flex-col gap-1 rounded-control bg-page px-3 py-2" data-testid="email-us-first">
                  <p>{EMAIL_US_FIRST}</p>
                  {pool ? <p>Our email is {pool.schoolEmail}.</p> : null}
                </div>
              ) : null}
              <Button
                variant="quiet"
                size="small"
                className="mt-1 self-start"
                onClick={() => void step.save((d) => ({ ...d, listedAdults: d.listedAdults.filter((x) => x.key !== a.key) }))}
              >
                Remove {a.firstName}
              </Button>
            </div>
          ))}
        </section>
      ) : null}

      {listed.length > 0 ? (
        <Button size="block" onClick={() => void step.advance((d) => ({ ...d, justMe: false }))}>
          Continue
        </Button>
      ) : (
        <Button size="block" onClick={() => void step.advance((d) => ({ ...d, justMe: true }))}>
          Just me for now
        </Button>
      )}

      <div className="flex flex-col gap-1 border-t-2 border-line pt-5">
        <h2 className="font-strong text-heading">Another adult staying too?</h2>
        <p>Add them here. Listed adults sign on paper at the check-in desk.</p>
      </div>

      {known.map((person) => (
        <section key={person} className="flex flex-col gap-2" aria-label={`Add ${person}`}>
          <p className="font-strong">Add {person} as:</p>
          <div className="flex flex-wrap gap-2">
            {RELATIONSHIPS.map((r) => (
              <Button key={r.id} variant="secondary" size="small" onClick={() => void addAdult(person, r.id)}>
                {r.label}
              </Button>
            ))}
          </div>
        </section>
      ))}

      <section className="flex flex-col gap-3 rounded-card border-2 border-dashed border-line p-5" aria-labelledby="someone-else">
        <h3 id="someone-else" className="font-strong text-heading">
          {known.length > 0 ? "Someone else" : "Their first name and how they're related"}
        </h3>
        <Field>
          <FieldLabel htmlFor="adult-first-name">First name</FieldLabel>
          <Input id="adult-first-name" name="listed-adult-first-name" value={name} onChange={(e) => setName(e.target.value)} />
          <Problem>{problems.name}</Problem>
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-strong">How they&apos;re related to your swimmer</legend>
          <RadioGroup value={relationship} onValueChange={(v) => setRelationship(v as Relationship)} className="gap-1">
            {RELATIONSHIPS.map((r) => (
              <div key={r.id} className="flex min-h-tap items-center gap-3">
                <RadioGroupItem value={r.id} id={`rel-${r.id}`} />
                <Label htmlFor={`rel-${r.id}`} className="font-regular">
                  {r.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
          <Problem>{problems.relationship}</Problem>
        </fieldset>
        <Button variant="secondary" size="block" onClick={addTyped}>
          Add this adult
        </Button>
      </section>

    </StepScreen>
  );
}
