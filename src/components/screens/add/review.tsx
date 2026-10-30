"use client";

import { useRef, useState, type ReactNode } from "react";

import { Done, Problem } from "@/components/screens/sign-up/shared";
import { PageTitle } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import { NOTHING_CHARGED_TODAY } from "@/content/sign-up";
import { getStore } from "@/data/app-store";
import { newId } from "@/data/ids";
import { ANY_TIME } from "@/data/types";
import { browserName } from "@/lib/browser";
import { ADD_PATH, AddIncompleteError, addSubject, addTimes, commitAdd } from "@/rules/add";
import { AlreadySavedError, TimeFilledError } from "@/rules/booking";
import { clockTime, longDate, weekdayName } from "@/rules/dates";
import { familyPayment } from "@/rules/family";
import { money } from "@/rules/prices";
import { currentRelease, familyNeedsToSign } from "@/rules/release";

import { AddScreen, useAddStep } from "./shared";

function kindLine(kind: "private" | "semi-private" | "evaluation", parentInWater: boolean, coach: string): string {
  if (kind === "evaluation") return `Free evaluation with Coach ${coach}`;
  return `${kind === "private" ? "Private" : "Semi-private"} with Coach ${coach}${parentInWater ? ", you're in the water too" : ""}`;
}

export function AddReviewStep() {
  const step = useAddStep("review");
  const [problem, setProblem] = useState<ReactNode | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  if (typeof step !== "object") return <AddScreen stepKey="review" step={step} />;
  const { data, today } = step.loaded;
  const { family, draft } = step;
  const who = addSubject(data, draft);
  const pool = data.pools.find((p) => p.id === draft.poolId)!;
  const t = addTimes(data, draft, today);
  const chosen = t && draft.kid.booking ? [...t.classes, ...t.evaluations].find((o) => o.id === draft.kid.booking!.timeId) : undefined;
  const { main } = familyPayment(data, family.id);
  const needsSign = draft.mode === "child" && familyNeedsToSign(data, family.id);
  const version = currentRelease(data);
  const price = chosen
    ? chosen.bankCents === null
      ? "The free evaluation is never charged."
      : main?.kind === "card"
        ? `${money(chosen.cardCents ?? chosen.bankCents)} a lesson by card`
        : `${money(chosen.bankCents)} a lesson by bank draft`
    : null;
  const waits = draft.kid.waitlistClassIds.map((id) => {
    if (id === ANY_TIME) return `any time that fits at ${pool.name}`;
    const cls = data.classes.find((c) => c.id === id);
    return cls ? `${weekdayName(cls.weekday)}s at ${clockTime(cls.startTime)}` : "a full class";
  });
  const label = draft.mode === "class" ? "Add this class" : needsSign ? `Sign and add ${who.firstName}` : `Add ${who.firstName}`;

  const add = async () => {
    if (busy.current) return; // ignores double taps
    busy.current = true;
    setSaving(true);
    try {
      await getStore().transaction((tx) =>
        commitAdd(tx, { draftId: draft.id, today, now: new Date().toISOString(), newId, browserName: browserName(navigator.userAgent) }),
      );
      step.go("/family/add/done", { replace: true });
    } catch (e) {
      busy.current = false;
      setSaving(false);
      if (e instanceof AlreadySavedError) {
        step.go("/family/add/done", { replace: true });
      } else if (e instanceof AddIncompleteError) {
        setProblem(
          <span className="flex flex-col gap-2">
            <span>{e.message}</span>
            <button type="button" className="min-h-tap self-start font-strong text-primary underline" onClick={() => step.go(ADD_PATH[e.step])}>
              Go to that step
            </button>
          </span>,
        );
      } else if (e instanceof TimeFilledError) {
        setProblem(e.message);
      } else {
        setProblem("That didn't save. Your answers are still here, so please try again.");
      }
    }
  };

  return (
    <AddScreen stepKey="review" step={step}>
      <PageTitle>Check and add</PageTitle>
      <section className="flex flex-col gap-1 rounded-card bg-surface p-5 shadow-card" aria-label={`${who.firstName}'s new lesson`} data-testid="add-review">
        <p className="font-heading text-big text-heading">{who.firstName}</p>
        {chosen ? (
          <>
            <p className="font-heading text-big text-heading">
              {longDate(chosen.firstLessonDate, today)}, {clockTime(chosen.startTime)}
            </p>
            <p>
              {pool.name}. {kindLine(chosen.lessonKind, chosen.parentInWater, chosen.instructorFirstName)}.
            </p>
            <p className="font-strong" data-testid="add-price">
              {price}
            </p>
          </>
        ) : null}
        {waits.map((w) => (
          <p key={w}>On the waitlist for {w}. If a spot opens, someone from the school will reach out.</p>
        ))}
      </section>
      <Done>{NOTHING_CHARGED_TODAY}</Done>
      {draft.mode === "child" ? (
        <p>
          {needsSign
            ? `You'll sign family release, version ${version.number}, once for everyone, with the answers you just gave.`
            : `Your family release, version ${version.number}, covers ${who.firstName} too. Nothing new to sign.`}
        </p>
      ) : null}
      <Problem>{problem}</Problem>
      <Button size="block" onClick={() => void add()} aria-disabled={saving ? true : undefined}>
        {saving ? "Saving..." : label}
      </Button>
    </AddScreen>
  );
}
