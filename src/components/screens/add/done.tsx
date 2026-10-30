"use client";

import { LaneLine } from "@/components/parts/lane-line";
import { SkeletonRows } from "@/components/parts/skeleton";
import { Tag } from "@/components/parts/tag";
import { Done } from "@/components/screens/sign-up/shared";
import { PageTitle, ScreenShell } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import { SAMPLE_ONLY_BOOKED } from "@/content/brand";
import { SOMEONE_WILL_TALK } from "@/content/sign-up";
import { useAppData } from "@/data/use-data";
import { useGo } from "@/lib/nav";
import { latestAddition } from "@/rules/add";
import { clockTime, longDate, weekdayName } from "@/rules/dates";
import { currentFamily, familyPayment, lessonInfo, lessonKindWords, priceTheyPay } from "@/rules/family";

/** Its own address: a refresh only reads what was added, so it never adds twice. */
export function AddDoneScreen() {
  const loaded = useAppData();
  const go = useGo();
  if (!loaded) {
    return (
      <ScreenShell id="add-done">
        <SkeletonRows rows={3} />
      </ScreenShell>
    );
  }
  const { data, today } = loaded;
  const family = currentFamily(data);
  const added = family ? latestAddition(data, family.id) : null;
  if (!family || !added) {
    return (
      <ScreenShell id="add-done">
        <PageTitle>Nothing added yet</PageTitle>
        <p>Add a brother or sister, or another class, from Home.</p>
        <Button size="block" onClick={() => go(family ? "/family/add" : "/sign-up")}>
          {family ? "Add a child or a class" : "Sign up for lessons"}
        </Button>
      </ScreenShell>
    );
  }
  const { child, enrollment } = added;
  const info = enrollment ? lessonInfo(data, enrollment) : null;
  const anotherClass = Boolean(enrollment) && data.enrollments.filter((e) => e.childRecordId === child.id && !e.endedOn).length > 1;
  const since = enrollment?.createdAt ?? child.createdAt;
  const waits = data.waitlistEntries.filter((w) => w.childRecordId === child.id && w.createdAt >= since);
  const { main } = familyPayment(data, family.id);
  const firstTimeAtPool = info && !data.enrollments.some((e) => e.familyId === family.id && e.id !== enrollment!.id && !e.endedOn && e.poolId === info.pool.id);

  return (
    <ScreenShell id="add-done">
      <div className="flex flex-col gap-3">
        <LaneLine />
        <PageTitle>
          {anotherClass && info
            ? info.lessonKind === "evaluation"
              ? `${child.firstName}'s free evaluation is added`
              : `${child.firstName}'s ${weekdayName(info.weekday)} class is added`
            : `${child.firstName} is signed up`}
        </PageTitle>
      </div>
      {info ? (
        <section className="flex flex-col gap-1 rounded-card bg-surface p-5 shadow-card" aria-label={`${child.firstName}'s new lesson`} data-testid="added-lesson">
          <p>{info.lessonKind === "evaluation" ? "Free evaluation" : "First lesson"}</p>
          <p className="font-heading text-big text-heading" data-testid="added-when">
            {longDate(info.firstLessonDate, today)}, {clockTime(info.startTime)}
          </p>
          <p data-testid="added-where">
            {info.pool.name} with Coach {info.instructorFirstName}
          </p>
          <p>{lessonKindWords(info)}</p>
          <p className="font-strong">{priceTheyPay(info, main) ?? "The free evaluation is never charged."}</p>
        </section>
      ) : null}
      {waits.map((w) => {
        const cls = w.classId ? data.classes.find((c) => c.id === w.classId) : null;
        return (
          <p key={w.id}>
            {child.firstName} is on the waitlist for {cls ? `${weekdayName(cls.weekday)}s at ${clockTime(cls.startTime)}` : "any time that fits"}. If a spot opens,
            someone from the school will reach out.
          </p>
        );
      })}
      {child.flaggedForPerson ? <p className="rounded-control bg-success px-3 py-2">{SOMEONE_WILL_TALK}</p> : null}
      <Done>Nothing was charged today.</Done>
      {firstTimeAtPool && info ? (
        <section className="flex flex-col gap-2" aria-labelledby="first-time-at-pool">
          <div className="flex items-center gap-2">
            <h2 id="first-time-at-pool" className="font-heading text-big text-heading">
              First time at {info.pool.name}?
            </h2>
            <Tag>SAMPLE</Tag>
          </div>
          <p>{info.pool.firstLesson.address}</p>
          <p>{info.pool.firstLesson.parking}</p>
          <p>{info.pool.firstLesson.door}</p>
          <p>{info.pool.firstLesson.arrive}</p>
        </section>
      ) : null}
      <p>{SAMPLE_ONLY_BOOKED}</p>
      <Button size="block" onClick={() => go("/")}>
        Go to Home
      </Button>
      <Button variant="secondary" size="block" onClick={() => go("/more/lessons")}>
        See lesson dates
      </Button>
    </ScreenShell>
  );
}
