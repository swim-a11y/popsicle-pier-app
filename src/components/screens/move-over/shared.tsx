"use client";

import type { ReactNode } from "react";

import { SkeletonRows } from "@/components/parts/skeleton";
import { PageTitle, ScreenShell } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import { getStore } from "@/data/app-store";
import type { Family, SignUpDraft } from "@/data/types";
import { useAppData, type Loaded } from "@/data/use-data";
import { useGo } from "@/lib/nav";
import { moveOverDraftId } from "@/rules/booking";
import { movingFamily } from "@/rules/family";
import { emptyDraft } from "@/rules/sign-up";

export const MOVE_STEPS = [
  { key: "details", screen: "move-over-details", href: "/move-over/details" },
  { key: "people", screen: "move-over-people", href: "/move-over/people" },
  { key: "classes", screen: "move-over-classes", href: "/move-over/classes" },
  { key: "email", screen: "move-over-email", href: "/move-over/email" },
  { key: "payment", screen: "move-over-payment", href: "/move-over/payment" },
  { key: "release", screen: "move-over-release", href: "/move-over/release" },
] as const;

export type MoveStepKey = (typeof MOVE_STEPS)[number]["key"];

export interface MoveOverStep {
  loaded: Loaded;
  family: Family;
  draft: SignUpDraft | null;
  save: (update: (d: SignUpDraft) => SignUpDraft) => Promise<SignUpDraft>;
  /** Records "Looks right" for a check, then goes to the next step. */
  looksRight: () => Promise<void>;
  next: () => void;
  go: (href: string, options?: { replace?: boolean }) => void;
}

/** The family moving over, its saved answers, and the way forward. */
export function useMoveOver(key: MoveStepKey): MoveOverStep | null | "none" {
  const loaded = useAppData();
  const go = useGo();
  if (!loaded) return null;
  const family = movingFamily(loaded.data);
  if (!family) return "none";
  const draftId = moveOverDraftId(family.id);
  const draft = loaded.data.signUpDrafts.find((d) => d.id === draftId) ?? null;
  const index = MOVE_STEPS.findIndex((s) => s.key === key);
  const nextHref = MOVE_STEPS[index + 1]?.href ?? "/";
  const save = (update: (d: SignUpDraft) => SignUpDraft) => {
    const now = new Date().toISOString();
    return getStore().transaction((tx) => {
      const existing = tx.get("signUpDrafts", draftId);
      const base = existing ?? { ...emptyDraft(draftId, now), email: family.email, fullName: family.parentFullName };
      const saved = { ...update(base), updatedAt: now, lastPath: MOVE_STEPS[index].href };
      if (existing) tx.update("signUpDrafts", draftId, saved);
      else tx.add("signUpDrafts", saved);
      return saved;
    });
  };
  return {
    loaded,
    family,
    draft,
    save,
    looksRight: async () => {
      await getStore().transaction((tx) => {
        const f = tx.get("families", family.id)!;
        if (!f.movingOverChecks.includes(key)) tx.update("families", family.id, { movingOverChecks: [...f.movingOverChecks, key] });
      });
      go(nextHref);
    },
    next: () => go(nextHref),
    go,
  };
}

export function MoveOverScreen({
  stepKey,
  step,
  title,
  hideTitle,
  children,
}: {
  stepKey: MoveStepKey;
  step: MoveOverStep | null | "none";
  title: string;
  /** The release form brings its own heading. */
  hideTitle?: boolean;
  children?: ReactNode;
}) {
  const index = MOVE_STEPS.findIndex((s) => s.key === stepKey);
  const screen = MOVE_STEPS[index].screen;
  const go = useGo();
  if (step === null) {
    return (
      <ScreenShell id={screen}>
        <SkeletonRows />
      </ScreenShell>
    );
  }
  if (step === "none") {
    return (
      <ScreenShell id={screen}>
        <PageTitle>{title}</PageTitle>
        <p>There&apos;s no family moving over on this phone.</p>
        <Button size="block" onClick={() => go("/")}>
          Go to Home
        </Button>
      </ScreenShell>
    );
  }
  return (
    <ScreenShell id={screen} backHref={index > 0 ? MOVE_STEPS[index - 1].href : "/move-over"} step={{ n: index + 1, total: MOVE_STEPS.length }}>
      {hideTitle ? null : <PageTitle>{title}</PageTitle>}
      {children}
    </ScreenShell>
  );
}

export function ChangeLine({ email }: { email: string }) {
  return <p className="rounded-card bg-surface px-4 py-3 shadow-card">Something to change? Email us at {email}.</p>;
}

export function LooksRight({ step }: { step: MoveOverStep }) {
  return (
    <Button size="block" onClick={() => void step.looksRight()}>
      Looks right
    </Button>
  );
}
