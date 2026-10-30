"use client";

import { CheckIcon } from "lucide-react";

import { Tag } from "@/components/parts/tag";
import { Button } from "@/components/ui/button";
import { NO_PARTNER_YET } from "@/content/sign-up";
import { ANY_TIME, type DraftChild, type SignUpDraft } from "@/data/types";
import { cn } from "@/lib/utils";
import { clockTime, longDate, weekdayName } from "@/rules/dates";
import { priceLines } from "@/rules/prices";
import { draftBirthDate, stepHref } from "@/rules/sign-up";
import { timesForChild, type TimeOption } from "@/rules/times";

import { NeedsEarlierStep, StepScreen, StepTitle, useSignUpStep } from "./shared";

function ageWords(months: number): string {
  return months % 12 === 0 ? `${months / 12}` : `${Math.floor(months / 12)} and a half`;
}

function kindWords(o: TimeOption): string {
  if (o.lessonKind === "evaluation") return `Free evaluation with Coach ${o.instructorFirstName}`;
  if (o.lessonKind === "private") return `Private with Coach ${o.instructorFirstName}`;
  return `Semi-private with Coach ${o.instructorFirstName}`;
}

function TimeDetails({ o, today }: { o: TimeOption; today: string }) {
  return (
    <>
      {o.kind === "class" ? <span className="block">First lesson {longDate(o.firstLessonDate, today)}</span> : null}
      <span className="block">{kindWords(o)}</span>
      {o.parentInWater ? <span className="block">You&apos;re in the water too.</span> : null}
      {o.bankCents !== null ? (
        <span className="mt-1 grid grid-cols-[auto_1fr] gap-x-4" data-testid="prices">
          {priceLines(o.bankCents).map((p) => (
            <span key={p.method} className="contents">
              <span className="font-strong">{p.label}</span>
              <span>{p.amount} a lesson</span>
            </span>
          ))}
        </span>
      ) : (
        <span className="block font-strong">Never charged</span>
      )}
      {o.sibling ? (
        <span className="mt-1 inline-flex self-start rounded-pill bg-mark px-3 py-0.5 font-strong text-on-mark">
          {o.sibling.relation === "same-time" ? `Same time as ${o.sibling.name}'s lesson` : `Next to ${o.sibling.name}'s lesson`}
        </span>
      ) : null}
      {o.noPartnerYet ? <span className="mt-1 block rounded-control bg-page px-3 py-2">{NO_PARTNER_YET}</span> : null}
    </>
  );
}

function timeTitle(o: TimeOption, today: string): string {
  return o.kind === "evaluation" ? `${longDate(o.firstLessonDate, today)} at ${clockTime(o.startTime)}` : `${weekdayName(o.weekday)}s at ${clockTime(o.startTime)}`;
}

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
      <StepScreen step={step} stepKey="times">
        <NeedsEarlierStep step={step} title="Pick a time" message="Pick a pool first." href="/sign-up/pool" label="Pick a pool" />
      </StepScreen>
    );
  }
  if (!kid || !birth) {
    return (
      <StepScreen step={step} stepKey="times">
        <NeedsEarlierStep step={step} title="Pick a time" message="Tell us about your swimmers first." href="/sign-up/swimmers" label="Add your swimmers" />
      </StepScreen>
    );
  }
  if (!kid.stage) {
    return (
      <StepScreen step={step} stepKey="times">
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
    <StepScreen step={step} stepKey="times">
      <div className="flex flex-col gap-2">
        <StepTitle>{kid.stage === "evaluation" ? `Pick a time for ${name}'s free evaluation` : `Pick a time for ${name}`}</StepTitle>
        <p>
          {pool.name} times that fit {name}.
          {t.under3 && !t.tooYoung ? ` ${name} is under 3, so lessons are private, with you in the water.` : ""}
        </p>
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
                <span className="flex items-center justify-between gap-2">
                  <span className="font-heading text-big text-heading">{timeTitle(o, today)}</span>
                  <Tag tone="plain">Full</Tag>
                </span>
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
        <Button size="block" onClick={() => void step.advance()}>
          Continue with the waitlist only
        </Button>
      ) : null}
      {chosen ? (
        <Button variant="secondary" size="block" onClick={() => void step.advance()}>
          Keep {timeTitle(chosen, today)} and continue
        </Button>
      ) : null}
    </StepScreen>
  );
}
