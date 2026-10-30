"use client";

import { CheckIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { ScreenShell } from "@/components/shell/screen-shell";
import { SkeletonRows } from "@/components/parts/skeleton";
import { evaluationAsksForCard } from "@/config";
import { getStore } from "@/data/app-store";
import type { SignUpDraft } from "@/data/types";
import { useAppData, type Loaded } from "@/data/use-data";
import { useGo, useQueryValue } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { emptyDraft, findStep, PER_CHILD, signUpSteps, type StepKey } from "@/rules/sign-up";
import { SIGN_UP_DRAFT_ID } from "@/sandbox/actions";

const STEP_SCREEN: Record<StepKey, string> = {
  pool: "sign-up-pool",
  swimmers: "sign-up-swimmers",
  stage: "sign-up-stage",
  times: "sign-up-times",
  you: "sign-up-you",
  people: "sign-up-people",
  "who-stays": "sign-up-who-stays",
  payment: "sign-up-payment",
  release: "sign-up-release",
};

export function nextHref(draft: SignUpDraft, key: StepKey, child: number): string {
  const steps = signUpSteps(draft, evaluationAsksForCard);
  const i = findStep(steps, key, child);
  return steps[i + 1]?.href ?? "/sign-up/youre-in";
}

export interface SignUpStep {
  loaded: Loaded;
  draft: SignUpDraft | null;
  /** 1-based for per-child steps, 0 otherwise. */
  child: number;
  position: { n: number; total: number };
  backHref: string;
  /** Saves the draft (keeping its place) and returns the saved draft. */
  save: (update: (d: SignUpDraft) => SignUpDraft) => Promise<SignUpDraft>;
  /** Saves, then moves to the next step this family needs. */
  advance: (update?: (d: SignUpDraft) => SignUpDraft) => Promise<void>;
  /** Saves what's typed, then goes one step back. */
  back: (update?: (d: SignUpDraft) => SignUpDraft) => Promise<void>;
  go: (href: string, options?: { replace?: boolean }) => void;
}

/** Stamps of the drafts the sign-up steps saved themselves; anything else came from outside (the Sandbox fill). */
const OUR_WRITES = new Set<string>();

/** Everything a sign-up step needs, or null until mounted and loaded. */
export function useSignUpStep(key: StepKey): SignUpStep | null {
  const loaded = useAppData();
  const go = useGo();
  const childParam = useQueryValue("child");
  const perChild = PER_CHILD.includes(key);
  const child = perChild ? Math.max(1, Number(childParam) || 1) : 0;
  const draft = loaded?.data.signUpDrafts.find((d) => d.id === SIGN_UP_DRAFT_ID) ?? null;

  const write = useCallback(async (update: (d: SignUpDraft) => SignUpDraft, lastPath?: (d: SignUpDraft) => string) => {
    const now = new Date().toISOString();
    OUR_WRITES.add(now);
    return getStore().transaction((tx) => {
      const existing = tx.get("signUpDrafts", SIGN_UP_DRAFT_ID);
      const updated = update(existing ?? emptyDraft(SIGN_UP_DRAFT_ID, now));
      const saved = { ...updated, updatedAt: now, lastPath: lastPath ? lastPath(updated) : updated.lastPath };
      if (existing) tx.update("signUpDrafts", SIGN_UP_DRAFT_ID, saved);
      else tx.add("signUpDrafts", saved);
      return saved;
    });
  }, []);

  if (!loaded || (perChild && childParam === undefined)) return null;
  const steps = signUpSteps(draft, evaluationAsksForCard);
  const index = Math.max(0, findStep(steps, key, child));
  const backHref = index > 0 ? steps[index - 1].href : "/sign-up";

  return {
    loaded,
    draft,
    child,
    position: { n: index + 1, total: steps.length },
    backHref,
    save: (update) => write(update),
    advance: async (update = (d) => d) => {
      const saved = await write(update, (d) => nextHref(d, key, child));
      go(saved.lastPath);
    },
    back: async (update = (d) => d) => {
      await write(update, () => backHref);
      go(backHref);
    },
    go,
  };
}

/**
 * Typed fields live in local state while a parent types, start from the
 * draft, and start over from the draft when it changes from outside (the
 * Sandbox fill). Nothing typed is lost: steps save on Continue, Back and blur.
 */
export function useDraftFields<T>(step: SignUpStep | null, pick: (d: SignUpDraft | null) => T): [T, (next: T | ((t: T) => T)) => void] {
  const [fields, setFields] = useState<T>(() => pick(null));
  const lastSync = useRef<string | null>(null);
  const draft = step?.draft ?? null;
  const updatedAt = step ? (draft?.updatedAt ?? "") : null;
  useEffect(() => {
    if (updatedAt === null) return;
    const first = lastSync.current === null;
    const ours = updatedAt === lastSync.current || OUR_WRITES.has(updatedAt);
    lastSync.current = updatedAt;
    // Start from the draft once, then again only when it changed from outside.
    if (first || !ours) setFields(pick(draft));
    // pick is stable per step; the draft changes with updatedAt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatedAt]);
  return [fields, setFields];
}

export function StepScreen({ step, stepKey, showStep = true, children }: { step: SignUpStep | null; stepKey: StepKey; showStep?: boolean; children: ReactNode }) {
  if (!step) {
    return (
      <ScreenShell id={STEP_SCREEN[stepKey]}>
        <SkeletonRows />
      </ScreenShell>
    );
  }
  return (
    <ScreenShell id={STEP_SCREEN[stepKey]} backHref={step.backHref} step={showStep ? step.position : null}>
      {children}
    </ScreenShell>
  );
}

export function StepTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h1 id={id} className="font-heading text-big text-heading">
      {children}
    </h1>
  );
}

/** One big tappable row. A screen with one single choice moves on when it's tapped. */
export function ChoiceButton({
  title,
  line,
  selected,
  onClick,
  children,
  testId,
  outlined,
}: {
  title: ReactNode;
  line?: ReactNode;
  selected?: boolean;
  onClick: () => void;
  children?: ReactNode;
  testId?: string;
  /** Inside a white card: a line-colored border so each choice still reads as tappable. */
  outlined?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected ? true : undefined}
      data-testid={testId}
      className={cn(
        "flex min-h-tap-big w-full flex-col items-start gap-1 rounded-card border-2 bg-surface px-4 py-3 text-left",
        outlined ? "shadow-none" : "shadow-card",
        selected ? "border-primary" : outlined ? "border-line" : "border-transparent",
      )}
    >
      <span className="flex w-full items-start justify-between gap-3">
        <span className="font-strong text-heading">{title}</span>
        {selected ? <CheckIcon className="size-6 shrink-0 text-primary" aria-hidden /> : null}
      </span>
      {line ? <span>{line}</span> : null}
      {children}
    </button>
  );
}

/** What to fix, next to the field, in the pale sun box. */
export function Problem({ children, id }: { children: ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="rounded-control bg-notice px-4 py-3">
      {children}
    </p>
  );
}

export function Done({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="flex items-center gap-2 rounded-control bg-success px-4 py-3">
      <CheckIcon className="size-5 shrink-0 text-heading" aria-hidden />
      {children}
    </p>
  );
}

/** Shown when a step is opened before the steps it needs. */
export function NeedsEarlierStep({ step, title, message, href, label }: { step: SignUpStep; title?: string; message: string; href: string; label: string }) {
  return (
    <div className="flex flex-col gap-4">
      {title ? <StepTitle>{title}</StepTitle> : null}
      <p>{message}</p>
      <button type="button" onClick={() => step.go(href)} className="min-h-tap-big rounded-control bg-primary px-6 font-strong text-primary-foreground">
        {label}
      </button>
    </div>
  );
}
