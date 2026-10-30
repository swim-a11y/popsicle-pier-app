"use client";

import { CheckRow, ReleaseForm, YesNo } from "@/components/screens/release-form";
import { Problem } from "@/components/screens/sign-up/shared";
import { PageTitle } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/parts/tag";
import { CHOICES_INTRO, CUSTODY_QUESTION, HEALTH_QUESTION, RELEASE_SAMPLE_NOTE } from "@/content/release";
import { useState } from "react";

import type { DraftChildRelease } from "@/data/types";
import { releaseProblem } from "@/rules/booking";
import { familyChildren } from "@/rules/family";
import { buildReleaseView, currentRelease, familyNeedsToSign } from "@/rules/release";
import { emptyDraft } from "@/rules/sign-up";

import { AddScreen, useAddStep } from "./shared";

export function AddQuestionsStep() {
  const step = useAddStep("questions");
  const [problem, setProblem] = useState<string | null>(null);
  if (typeof step !== "object") return <AddScreen stepKey="questions" step={step} />;
  const { data } = step.loaded;
  const { family, draft } = step;
  const version = currentRelease(data);
  const pool = data.pools.find((p) => p.id === draft.poolId)!;
  const name = draft.kid.firstName.trim();

  if (familyNeedsToSign(data, family.id)) {
    // An older release: the current one, signed once for everyone, the new child included.
    const kids = [...familyChildren(data, family.id).map((c) => ({ key: c.id, firstName: c.firstName })), { key: draft.kid.key, firstName: name }];
    return (
      <AddScreen stepKey="questions" step={step}>
        <ReleaseForm
          version={version}
          kids={kids}
          schoolEmail={pool.schoolEmail}
          release={draft.release ?? emptyDraft("x", "").release}
          signLabel="Continue"
          onChange={(release) => void step.save((d) => ({ ...d, release }))}
          onSign={async (release) => {
            const found = releaseProblem(version, release, kids.map((k) => k.key));
            if (found) return found;
            await step.advance((d) => ({ ...d, release }));
            return null;
          }}
        />
      </AddScreen>
    );
  }

  const a = draft.answers;
  const set = (patch: Partial<DraftChildRelease>) => {
    setProblem(null);
    void step.save((d) => ({ ...d, answers: { ...d.answers, ...patch } }));
  };
  const choices = buildReleaseView(version, [{ key: draft.kid.key, firstName: name }], pool.schoolEmail).choices[0];
  const onContinue = () => {
    if (!a.custody || !a.health) {
      setProblem("Please answer yes or no to both questions.");
      document.getElementById(`${draft.kid.key}-${a.custody ? "health" : "custody"}-yes`)?.focus();
      return;
    }
    void step.advance();
  };

  return (
    <AddScreen stepKey="questions" step={step}>
      <PageTitle>A few things about {name}</PageTitle>
      <p className="flex flex-wrap items-center gap-2">
        <Tag tone="plain">SAMPLE</Tag>
        {RELEASE_SAMPLE_NOTE}
      </p>
      <p>
        Your family release, version {version.number}, already covers {name}. There&apos;s nothing new to sign. Just answer these for {name}.
      </p>
      <section className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card" aria-label={`Questions about ${name}`}>
        <YesNo id={`${draft.kid.key}-custody`} question={CUSTODY_QUESTION.replaceAll("[name]", name)} value={a.custody} invalid={Boolean(problem) && !a.custody} onChange={(v) => set({ custody: v })} />
        <YesNo id={`${draft.kid.key}-health`} question={HEALTH_QUESTION.replaceAll("[name]", name)} value={a.health} invalid={Boolean(problem) && !a.health} onChange={(v) => set({ health: v })} />
      </section>
      <section className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card" aria-label={`Choices for ${name}`}>
        <p className="font-strong text-heading">{CHOICES_INTRO}</p>
        {choices.items.map((item) => (
          <div key={item.key} className="flex flex-col gap-1">
            <p className="font-strong">{item.title}</p>
            {item.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <CheckRow id={`${draft.kid.key}-${item.key}`} checked={a[item.key]} onChange={(v) => set({ [item.key]: v })}>
              {item.boxText}
            </CheckRow>
          </div>
        ))}
      </section>
      <Problem>{problem}</Problem>
      <Button size="block" onClick={onContinue}>
        Continue
      </Button>
    </AddScreen>
  );
}
