"use client";

import { Tag } from "@/components/parts/tag";
import { NOT_SURE, PATH_STAGES } from "@/content/path";
import type { DraftChild } from "@/data/types";

import { ChoiceButton, NeedsEarlierStep, StepScreen, StepTitle, useSignUpStep } from "./shared";

export function StageStep() {
  const step = useSignUpStep("stage");
  const kid = step?.draft?.children[step.child - 1];
  const choose = (stage: DraftChild["stage"]) =>
    step?.advance((d) => ({
      ...d,
      children: d.children.map((c, i) => (i === step.child - 1 ? { ...c, stage, booking: c.stage === stage ? c.booking : null } : c)),
    }));

  return (
    <StepScreen step={step} stepKey="stage">
      {step && !kid ? (
        <NeedsEarlierStep step={step} title="Where your swimmer is today" message="Tell us about your swimmers first." href="/sign-up/swimmers" label="Add your swimmers" />
      ) : null}
      {step && kid ? (
        <>
          <div className="flex flex-col gap-2">
            <StepTitle>Which sounds most like {kid.firstName} today?</StepTitle>
            <Tag>Sample lines</Tag>
          </div>
          <div className="flex flex-col gap-3">
            {PATH_STAGES.map((s) => (
              <ChoiceButton key={s.id} title={s.name} line={s.soundsLike} selected={kid.stage === s.id} onClick={() => choose(s.id)} />
            ))}
            <ChoiceButton title={NOT_SURE.title} line={NOT_SURE.line} selected={kid.stage === "evaluation"} onClick={() => choose("evaluation")} />
          </div>
        </>
      ) : null}
    </StepScreen>
  );
}
