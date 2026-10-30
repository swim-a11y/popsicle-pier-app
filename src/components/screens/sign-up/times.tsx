"use client";

import { CheckIcon } from "lucide-react";

import { Tag } from "@/components/parts/tag";
import { PinnedBar } from "@/components/parts/pinned-bar";
import { ageWords, TimeDetails, timeTitle } from "@/components/parts/time-card";
import { Button } from "@/components/ui/button";
import { ANY_TIME, type DraftChild, type SignUpDraft } from "@/data/types";
import { cn } from "@/lib/utils";
import { longDate } from "@/rules/dates";
import { draftBirthDate, stepHref } from "@/rules/sign-up";
import { timesForChild, type TimeOption } from "@/rules/times";

import { NeedsEarlierStep, StepScreen, StepTitle, useSignUpStep } from "./shared";

export function TimesStep() {
  const step = useSignUpStep("times");
  if (!step) return <StepScreen step={step} stepKey="times">{null}</StepScreen>;
  const { draft, loaded, child } = step;
  const { data, today } = loaded;
  const pool = data.pools.find((p) => p.id === draft?.poolId);
  const kid = draft?.children[child - 1];
  const birth = kid ? draftBirthDate(kid) : null;

  if (!draft || !pool) {
    return (
      <StepScreen step={step} stepKey="times" showStep={false}>
        <NeedsEarlierStep step={step} title="Pick a time" message="Pick a pool first." href="/sign-up/pool" label="Pick a pool" />
      </StepScreen>
    );
  }
  if (!kid || !birth) {
    return (
      <StepScreen step={step} stepKey="times" showStep={false}>
        <NeedsEarlierStep step={step} title="Pick a time" message="Tell us about your swimmers first." href="/sign-up/swimmers" label="Add your swimmers" />
      </StepScreen>
    );
  }
  if (!kid.stage) {
    return (
      <StepScreen step={step} stepKey="times" showStep={false}>
        <NeedsEarlierStep step={step} title={`Pick a time for ${kid.firstName}`} message={`Tell us where ${kid.firstName} is today first.`} href={stepHref("stage", child)} label="Pick a stage" />
      </StepScreen>
    );
  }

  const siblings = draft.children.filter((_, i) => i !== child - 1).map((c) => ({ name: c.firstName, booking: c.booking }));
  const t = timesForChild({ data, poolId: pool.id, birthDate: birth, stage: kid.stage, today, siblings });
  const name = kid.firstName;
  const setKid = (fn: (c: DraftChild) => DraftChild) => (d: SignUpDraft) => ({ ...d, children: d.children.map((c, i) => (i === child - 1 ? fn(c) : c)) });
  const book = (o: TimeOption) => step.advance(setKid((c) => ({ ...c, booking: { kind: o.kind, timeId: o.id } })));
  const toggleWaitlist = (classId: string) =>
    step.save(
      setKid((c) => ({
        ...c,
        waitlistClassIds: c.waitlistClassIds.includes(classId) ? c.waitlistClassIds.filter((x) => x !== classId) : [...c.waitlistClassIds, classId],
      })),
    );
  const onWaitlist = (classId: string) => kid.waitlistClassIds.includes(classId);
  const chosen = [...t.classes, ...t.evaluations].find((o) => o.id === kid.booking?.timeId);
  const otherPool = data.pools.find((p) => p.id !== pool.id && t.ageMonthsOnFirst !== null && t.ageMonthsOnFirst >= p.youngestAgeMonths);

  const waitlistButton = (classId: string, label: string) => (
    <Button variant="secondary" size="block" aria-pressed={onWaitlist(classId)} onClick={() => void toggleWaitlist(classId)}>
      {onWaitlist(classId) ? (
        <>
          <CheckIcon className="size-5" aria-hidden /> On the waitlist
        </>
      ) : (
        label
      )}
    </Button>
  );

  return (
    <StepScreen step={step} stepKey="times" pinned={!kid.booking && kid.waitlistClassIds.length > 0}>
      <div className="flex flex-col gap-2">
        <StepTitle>{kid.stage === "evaluation" ? `Pick a time for ${name}'s free evaluation` : `Pick a time for ${name}`}</StepTitle>
        {!t.tooYoung && (t.classes.length > 0 || kid.stage === "evaluation") ? (
          <p>
            {pool.name} times that fit {name}.{t.under3 ? ` ${name} is under 3, so lessons are private, with you in the water.` : ""}
          </p>
        ) : null}
      </div>

      {t.tooYoung ? (
        <div className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card" data-testid="too-young">
          <p className="font-heading text-big text-heading">
            {name} can start at {pool.name} from {longDate(t.tooYoung.canStartOn, today)}.
          </p>
          <p>
            {pool.name} lessons start at age {ageWords(t.tooYoung.youngestAgeMonths)}.
            {otherPool ? ` ${otherPool.name} starts at ${ageWords(otherPool.youngestAgeMonths)}.` : ""}
          </p>
          {otherPool ? (
            <Button
              size="block"
              onClick={() =>
                void step
                  .save((d) => ({ ...d, poolId: otherPool.id, children: d.children.map((c) => ({ ...c, booking: null, waitlistClassIds: [] })) }))
                  .then(() => step.go(stepHref("times", child)))
              }
            >
              See {otherPool.name} times
            </Button>
          ) : null}
          {waitlistButton(ANY_TIME, `Join the ${pool.name} waitlist`)}
        </div>
      ) : null}

      {!t.tooYoung && kid.stage !== "evaluation" ? (
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
              <button
                key={o.id}
                type="button"
                data-testid={`time-${o.id}`}
                aria-pressed={kid.booking?.timeId === o.id ? true : undefined}
                onClick={() => void book(o)}
                className={cn(
                  "flex w-full flex-col items-start gap-1 rounded-card border-2 bg-surface px-4 py-3 text-left shadow-card",
                  kid.booking?.timeId === o.id ? "border-primary" : "border-transparent",
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="font-heading text-big text-heading">{timeTitle(o, today)}</span>
                  {kid.booking?.timeId === o.id ? <CheckIcon className="size-6 text-primary" aria-hidden /> : null}
                </span>
                <TimeDetails o={o} today={today} />
              </button>
            ),
          )}
          {t.nothingFits ? (
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

      {!t.tooYoung ? (
        <section className="flex flex-col gap-3" aria-labelledby="evaluation-times">
          <h2 id="evaluation-times" className="font-heading text-body text-heading">
            {kid.stage === "evaluation" ? "Free evaluation times" : "Or start with a free evaluation"}
          </h2>
          {kid.stage !== "evaluation" ? <p>A coach meets {name} in the water, then we pick a class together. Never charged.</p> : null}
          {t.evaluations.map((o) => (
            <button
              key={o.id}
              type="button"
              data-testid={`time-${o.id}`}
              aria-pressed={kid.booking?.timeId === o.id ? true : undefined}
              disabled={o.full}
              onClick={() => void book(o)}
              className={cn(
                "flex w-full flex-col items-start gap-1 rounded-card border-2 bg-surface px-4 py-3 text-left shadow-card disabled:opacity-60",
                kid.booking?.timeId === o.id ? "border-primary" : "border-transparent",
              )}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="font-strong text-heading">{timeTitle(o, today)}</span>
                {o.full ? <Tag>Full</Tag> : null}
                {kid.booking?.timeId === o.id ? <CheckIcon className="size-6 text-primary" aria-hidden /> : null}
              </span>
              <TimeDetails o={o} today={today} />
            </button>
          ))}
        </section>
      ) : null}

      {!kid.booking && kid.waitlistClassIds.length > 0 ? (
        <PinnedBar>
          <Button size="block" onClick={() => void step.advance()}>
            Continue with the waitlist only
          </Button>
        </PinnedBar>
      ) : null}
      {chosen ? (
        <Button variant="secondary" size="block" onClick={() => void step.advance()}>
          Keep {timeTitle(chosen, today)} and continue
        </Button>
      ) : null}
    </StepScreen>
  );
}
