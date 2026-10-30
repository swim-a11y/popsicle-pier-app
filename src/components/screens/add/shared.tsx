"use client";

import type { ReactNode } from "react";

import { SkeletonRows } from "@/components/parts/skeleton";
import { PageTitle, ScreenShell } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import { getStore } from "@/data/app-store";
import type { AddDraft, Family } from "@/data/types";
import { useAppData, type Loaded } from "@/data/use-data";
import { useGo } from "@/lib/nav";
import { ADD_PATH, addDraftId, addSteps, type AddStepKey } from "@/rules/add";
import { currentFamily } from "@/rules/family";

export const ADD_SCREEN: Record<AddStepKey, string> = {
  child: "add-child",
  stage: "add-stage",
  times: "add-times",
  questions: "add-questions",
  review: "add-review",
};

export interface AddStep {
  loaded: Loaded;
  family: Family;
  draft: AddDraft;
  position: { n: number; total: number };
  backHref: string;
  save: (update: (d: AddDraft) => AddDraft) => Promise<AddDraft>;
  advance: (update?: (d: AddDraft) => AddDraft) => Promise<void>;
  go: (href: string, options?: { replace?: boolean }) => void;
}

export type AddStepState = AddStep | "loading" | "no-family" | "no-draft";

/** Everything a step of adding a child or a class needs. */
export function useAddStep(key: AddStepKey): AddStepState {
  const loaded = useAppData();
  const go = useGo();
  if (!loaded) return "loading";
  const family = currentFamily(loaded.data);
  if (!family) return "no-family";
  const id = addDraftId(family.id);
  const draft = loaded.data.addDrafts.find((d) => d.id === id);
  const steps = draft ? addSteps(draft) : [];
  const index = steps.indexOf(key);
  if (!draft || index < 0) return "no-draft";
  const write = (update: (d: AddDraft) => AddDraft, lastPath?: string) => {
    const now = new Date().toISOString();
    return getStore().transaction((tx) => {
      const existing = tx.get("addDrafts", id);
      if (!existing) throw new Error("Start again from Add a child or a class.");
      const next = { ...update(existing), id, updatedAt: now, lastPath: lastPath ?? existing.lastPath };
      tx.update("addDrafts", id, next);
      return next;
    });
  };
  const nextKey = steps[index + 1];
  const nextHref = nextKey ? ADD_PATH[nextKey] : "/family/add/done";
  return {
    loaded,
    family,
    draft,
    position: { n: index + 1, total: steps.length },
    backHref: index > 0 ? ADD_PATH[steps[index - 1]] : "/family/add",
    save: (update) => write(update),
    advance: async (update = (d) => d) => {
      await write(update, nextHref);
      go(nextHref);
    },
    go,
  };
}

export function AddScreen({ stepKey, step, children }: { stepKey: AddStepKey; step: AddStepState; children?: ReactNode }) {
  const go = useGo();
  const id = ADD_SCREEN[stepKey];
  if (step === "loading") {
    return (
      <ScreenShell id={id}>
        <SkeletonRows />
      </ScreenShell>
    );
  }
  if (step === "no-family" || step === "no-draft") {
    return (
      <ScreenShell id={id} backHref="/">
        <PageTitle>Add a child or a class</PageTitle>
        <p>{step === "no-family" ? "Sign up first. Then you can add a brother or sister, or another class." : "Start from Add a child or a class."}</p>
        <Button size="block" onClick={() => go(step === "no-family" ? "/sign-up" : "/family/add")}>
          {step === "no-family" ? "Sign up for lessons" : "Add a child or a class"}
        </Button>
      </ScreenShell>
    );
  }
  return (
    <ScreenShell id={id} backHref={step.backHref} step={step.position}>
      {children}
    </ScreenShell>
  );
}
