"use client";

import { CheckIcon } from "lucide-react";

import { Tag } from "@/components/parts/tag";
import { ageWords, TimeDetails, timeTitle } from "@/components/parts/time-card";
import { PageTitle } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import { ANY_TIME, type AddDraft } from "@/data/types";
import { cn } from "@/lib/utils";
import { addSubject, addTimes } from "@/rules/add";
import { longDate } from "@/rules/dates";
import type { TimeOption } from "@/rules/times";

import { AddScreen, useAddStep } from "./shared";

export function AddTimesStep() {
  const step = useAddStep("times");
  if (typeof step !== "object") return <AddScreen stepKey="times" step={step} />;
  const { data, today } = step.loaded;
  const draft = step.draft;
  const who = addSubject(data, draft);
  const t = addTimes(data, draft, today);
  const pool = data.pools.find((p) => p.id === draft.poolId)!;
  const other = data.pools.find((p) => p.id !== draft.poolId);
  const kid = draft.kid;
  const name = who.firstName || "your swimmer";

  const book = (o: TimeOption) => void step.advance((d) => ({ ...d, kid: { ...d.kid, booking: { kind: o.kind, timeId: o.id } } }));
  const toggleWaitlist = (classId: string) =>
    void step.save((d) => ({
      ...d,
      kid: { ...d.kid, waitlistClassIds: d.kid.waitlistClassIds.includes(classId) ? d.kid.waitlistClassIds.filter((x) => x !== classId) : [...d.kid.waitlistClassIds, classId] },
    }));
  const switchPool = (poolId: string) => void step.save((d: AddDraft) => ({ ...d, poolId, kid: { ...d.kid, booking: null, waitlistClassIds: [] } }));
  const onWaitlist = (classId: string) => kid.waitlistClassIds.includes(classId);
  const waitlistButton = (classId: string, label: string) => (
    <Button variant="secondary" size="block" aria-pressed={onWaitlist(classId)} onClick={() => toggleWaitlist(classId)}>
      {onWaitlist(classId) ? (
        <>
          <CheckIcon className="size-5" aria-hidden /> On the waitlist
        </>
      ) : (
        label
      )}
    </Button>
  );
  const optionButton = (o: TimeOption, big: boolean) => (
    <button
      key={o.id}
      type="button"
      data-testid={`time-${o.id}`}
      aria-pressed={kid.booking?.timeId === o.id ? true : undefined}
      disabled={o.full}
      onClick={() => book(o)}
      className={cn(
        "flex w-full flex-col items-start gap-1 rounded-card border-2 bg-surface px-4 py-3 text-left shadow-card disabled:opacity-60",
        kid.booking?.timeId === o.id ? "border-primary" : "border-transparent",
      )}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className={big ? "font-heading text-big text-heading" : "font-strong text-heading"}>{timeTitle(o, today)}</span>
        {kid.booking?.timeId === o.id ? <CheckIcon className="size-6 text-primary" aria-hidden /> : null}
      </span>
      <TimeDetails o={o} today={today} />
    </button>
  );

  return (
    <AddScreen stepKey="times" step={step}>
      <div className="flex flex-col gap-2">
        <PageTitle>{draft.mode === "class" ? `Another class for ${name}` : `Pick a time for ${name}`}</PageTitle>
        {t && !t.tooYoung && (t.classes.length > 0 || t.evaluations.length > 0) ? (
          <p>
            {pool.name} times that fit {name}.{t.under3 ? ` ${name} is under 3, so lessons are private, with you in the water.` : ""}
          </p>
        ) : null}
      </div>
      {other ? (
        <Button variant="secondary" size="block" onClick={() => switchPool(other.id)}>
          See {other.name} times instead
        </Button>
      ) : null}

      {!t ? <p>Tell us their birth date and stage first.</p> : null}

      {t?.tooYoung ? (
        <div className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card" data-testid="too-young">
          <p className="font-heading text-big text-heading">
            {name} can start at {pool.name} from {longDate(t.tooYoung.canStartOn, today)}.
          </p>
          <p>
            {pool.name} lessons start at age {ageWords(t.tooYoung.youngestAgeMonths)}.
          </p>
          {waitlistButton(ANY_TIME, `Join the ${pool.name} waitlist`)}
        </div>
      ) : null}

      {t && !t.tooYoung ? (
        <section className="flex flex-col gap-3" aria-label={`Times for ${name}`}>
          {t.classes.map((o) =>
            o.full ? (
              <div key={o.id} className="flex flex-col gap-1 rounded-card border-2 border-dashed border-line px-4 py-3" data-testid={`time-${o.id}`}>
                <span className="font-heading text-big text-heading">{timeTitle(o, today)}</span>
                <Tag tone="plain">Full</Tag>
                <TimeDetails o={o} today={today} />
                <div className="pt-2">{waitlistButton(o.id, "Join the waitlist")}</div>
              </div>
            ) : (
              optionButton(o, true)
            ),
          )}
          {t.nothingFits && t.evaluations.length === 0 && draft.mode === "class" ? (
            <div className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card" data-testid="nothing-fits">
              <p className="font-strong text-heading">
                Nothing open fits {name} at {pool.name} right now.
              </p>
              <p>Try the other pool, or join the waitlist and someone from the school will reach out when a time opens.</p>
              {waitlistButton(ANY_TIME, "Join the waitlist")}
            </div>
          ) : null}
          {t.nothingFits && draft.mode === "child" && kid.stage !== "evaluation" ? (
            <div className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card" data-testid="nothing-fits">
              <p className="font-strong text-heading">
                Nothing open fits {name} at {pool.name} right now.
              </p>
              <p>Join the waitlist and someone from the school will reach out when a time opens, or book a free evaluation below.</p>
              {waitlistButton(ANY_TIME, "Join the waitlist")}
            </div>
          ) : null}
        </section>
      ) : null}

      {t && !t.tooYoung && t.evaluations.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="add-evaluation-times">
          <h2 id="add-evaluation-times" className="font-heading text-body text-heading">
            {kid.stage === "evaluation" || who.stage === "evaluation" ? "Free evaluation times" : "Or start with a free evaluation"}
          </h2>
          {t.evaluations.map((o) => optionButton(o, false))}
        </section>
      ) : null}

      {!kid.booking && kid.waitlistClassIds.length > 0 ? (
        <Button size="block" onClick={() => void step.advance()}>
          Continue with the waitlist only
        </Button>
      ) : null}
    </AddScreen>
  );
}
