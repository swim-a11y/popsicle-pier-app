"use client";

import { Tag } from "@/components/parts/tag";
import { ChoiceButton } from "@/components/screens/sign-up/shared";
import { PageTitle } from "@/components/shell/screen-shell";
import { NOT_SURE, PATH_STAGES } from "@/content/path";
import type { DraftChild } from "@/data/types";

import { AddScreen, useAddStep } from "./shared";

export function AddStageStep() {
  const step = useAddStep("stage");
  if (typeof step !== "object") return <AddScreen stepKey="stage" step={step} />;
  const kid = step.draft.kid;
  const name = kid.firstName.trim() || "your swimmer";
  const choose = (stage: DraftChild["stage"]) =>
    void step.advance((d) => ({ ...d, kid: { ...d.kid, stage, booking: d.kid.stage === stage ? d.kid.booking : null } }));
  return (
    <AddScreen stepKey="stage" step={step}>
      <div className="flex flex-col gap-2">
        <PageTitle>Which sounds most like {name} today?</PageTitle>
        <Tag>Sample lines</Tag>
      </div>
      <div className="flex flex-col gap-3">
        {PATH_STAGES.map((s) => (
          <ChoiceButton key={s.id} title={s.name} line={s.soundsLike} selected={kid.stage === s.id} onClick={() => choose(s.id)} />
        ))}
        <ChoiceButton title={NOT_SURE.title} line={NOT_SURE.line} selected={kid.stage === "evaluation"} onClick={() => choose("evaluation")} />
      </div>
    </AddScreen>
  );
}
