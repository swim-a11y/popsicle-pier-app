"use client";

import { LaneLine } from "@/components/parts/lane-line";
import { SkeletonRows } from "@/components/parts/skeleton";
import { PageTitle, ScreenShell } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import { SAMPLE_ONLY_BOOKED } from "@/content/brand";
import { SOMEONE_WILL_TALK } from "@/content/sign-up";
import { useAppData } from "@/data/use-data";
import { useGo } from "@/lib/nav";
import { clockTime, longDate, weekdayName } from "@/rules/dates";
import { currentFamily, familyChildren, familyLessons, familyPayment, lessonKindWords, priceTheyPay } from "@/rules/family";
import { namesList } from "@/rules/release";

/** Its own address: a refresh only reads what was saved, so it never books twice. */
export function YoureInScreen() {
  const loaded = useAppData();
  const go = useGo();
  if (!loaded) {
    return (
      <ScreenShell id="youre-in">
        <SkeletonRows rows={3} />
      </ScreenShell>
    );
  }
  const { data, today } = loaded;
  const family = currentFamily(data);
  if (!family || family.source !== "sign-up") {
    return (
      <ScreenShell id="youre-in">
        <PageTitle>Nothing booked yet</PageTitle>
        <p>Nothing is booked on this phone yet. Sign up to save a spot.</p>
        <Button size="block" onClick={() => go("/sign-up")}>
          Start sign-up
        </Button>
      </ScreenShell>
    );
  }
  const kids = familyChildren(data, family.id);
  const lessons = familyLessons(data, family.id);
  const { main } = familyPayment(data, family.id);
  const anyClass = lessons.some((l) => l.lessonKind !== "evaluation");
  const pool = data.pools.find((p) => p.id === family.homePoolId);
  const seeFirstLesson = (
    <Button size="block" onClick={() => go("/first-lesson")}>
      See your first lesson
    </Button>
  );

  return (
    <ScreenShell id="youre-in">
      <div className="flex flex-col gap-3">
        <LaneLine />
        <PageTitle>You&apos;re in</PageTitle>
        <p>
          {namesList(kids.map((k) => k.firstName))} {kids.length === 1 ? "is" : "are"} signed up at {pool?.name}.
        </p>
      </div>
      {kids.length > 1 ? seeFirstLesson : null}
      {kids.map((kid) => {
        const lesson = lessons.find((l) => l.child.id === kid.id);
        const waits = data.waitlistEntries.filter((w) => w.childRecordId === kid.id);
        return (
          <section key={kid.id} className="flex flex-col gap-2 rounded-card bg-surface p-5 shadow-card" aria-labelledby={`kid-${kid.id}`} data-testid="booked-child">
            <h2 id={`kid-${kid.id}`} className="font-heading text-big text-heading">
              {kid.firstName}
            </h2>
            {lesson ? (
              <>
                <p>{lesson.lessonKind === "evaluation" ? "Free evaluation" : "First lesson"}</p>
                <p className="font-heading text-big text-heading" data-testid="first-lesson-when">
                  {longDate(lesson.firstLessonDate, today)}, {clockTime(lesson.startTime)}
                </p>
                <p data-testid="first-lesson-where">
                  {lesson.pool.name} with Coach {lesson.instructorFirstName}
                </p>
                <p>{lessonKindWords(lesson)}</p>
                <p className="font-strong" data-testid="price-they-pay">
                  {priceTheyPay(lesson, main) ?? "The free evaluation is never charged."}
                </p>
              </>
            ) : null}
            {waits.map((w) => {
              const cls = w.classId ? data.classes.find((c) => c.id === w.classId) : null;
              return (
                <p key={w.id}>
                  On the waitlist for {cls ? `${weekdayName(cls.weekday)}s at ${clockTime(cls.startTime)}` : `any time that fits at ${pool?.name}`}. If a spot
                  opens, someone from the school will reach out.
                </p>
              );
            })}
            {kid.flaggedForPerson ? <p className="rounded-control bg-success px-3 py-2">{SOMEONE_WILL_TALK}</p> : null}
          </section>
        );
      })}
      {kids.length === 1 ? seeFirstLesson : null}
      <p className="rounded-card bg-success px-4 py-3">
        {anyClass ? "Nothing was charged today. Your first bill comes before your first lesson." : "Nothing was charged today. The free evaluation is never charged."}
      </p>
      <p>{SAMPLE_ONLY_BOOKED}</p>
    </ScreenShell>
  );
}
