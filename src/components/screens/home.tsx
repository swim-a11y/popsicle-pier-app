"use client";

import { NoteCard } from "@/components/parts/note-card";
import { SkeletonRows } from "@/components/parts/skeleton";
import { Tag } from "@/components/parts/tag";
import { PageTitle, ScreenShell } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import { SCHOOL_NAME } from "@/content/brand";
import { CLIPS_LATER_LINE } from "@/content/first-lesson";
import { stageName } from "@/content/path";
import { useAppData } from "@/data/use-data";
import { useGo } from "@/lib/nav";
import { clockTime, longDate, monthDayYear, todayAtSchool, weekdayName } from "@/rules/dates";
import { approvedNotesForFamily } from "@/rules/first-sunday";
import { currentFamily, familyChildren, familyLessons, familyPayment, howTheyPay, lessonKindWords, lessonPerChild, upcomingLessonDate } from "@/rules/family";
import { money } from "@/rules/prices";
import { latestSignature, namesList } from "@/rules/release";

export function HomeScreen() {
  const loaded = useAppData();
  const go = useGo();
  if (!loaded) {
    return (
      <ScreenShell id="parent-home">
        <SkeletonRows rows={4} />
      </ScreenShell>
    );
  }
  const { data, today } = loaded;
  const family = currentFamily(data);

  if (!family) {
    return (
      <ScreenShell id="parent-home">
        <PageTitle>Welcome to {SCHOOL_NAME}</PageTitle>
        <p>Swim lessons at Madison and Buckhead, with a parent beside every child. Start with a class time or a free evaluation.</p>
        <Button size="block" onClick={() => go("/sign-up")}>
          Sign up for lessons
        </Button>
      </ScreenShell>
    );
  }

  const kids = familyChildren(data, family.id);
  const lessons = familyLessons(data, family.id);
  const firsts = lessonPerChild(data, family.id);
  const notes = approvedNotesForFamily(data, family.id);
  const signature = latestSignature(data, family.id);
  const version = signature ? data.releaseVersions.find((v) => v.id === signature.versionId) : undefined;
  const { main } = familyPayment(data, family.id);
  const movingNotDone = family.source === "moving-over" && !family.movedOverAt;
  const next = firsts.map((l) => ({ ...l, date: upcomingLessonDate(data, l, today) })).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  const firstTitle = family.source === "moving-over" || data.attendanceMarks.some((m) => m.familyId === family.id) ? "Your next lesson" : "Your first lesson";

  return (
    <ScreenShell id="parent-home">
      <PageTitle>Hi, {family.parentFullName.split(" ")[0]}</PageTitle>

      {movingNotDone ? (
        <section className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card" aria-labelledby="finish-moving">
          <h2 id="finish-moving" className="font-heading text-big text-heading">
            Finish moving over
          </h2>
          <p>Check your details, link your bank and sign the family release. About a minute.</p>
          <Button size="block" onClick={() => go("/move-over")}>
            Continue moving over
          </Button>
        </section>
      ) : notes.length > 0 ? (
        <div className="flex flex-col gap-3" data-testid="home-lead">
          <NoteCard data={data} note={notes[0]} today={today} />
          <Button variant="secondary" size="block" onClick={() => go("/progress")}>
            See every note
          </Button>
        </div>
      ) : next ? (
        <section className="flex flex-col gap-2 rounded-card bg-surface p-5 shadow-card" aria-labelledby="first-lesson-card" data-testid="home-lead">
          <h2 id="first-lesson-card" className="font-heading text-big text-heading">
            {firstTitle}
          </h2>
          <p className="font-heading text-big text-heading">
            {longDate(next.date, today)}, {clockTime(next.startTime)}
          </p>
          <p>
            {namesList(firsts.filter((l) => upcomingLessonDate(data, l, today) === next.date).map((l) => l.child.firstName))} at {next.pool.name} with Coach{" "}
            {next.instructorFirstName}
          </p>
          <Button size="block" onClick={() => go("/first-lesson")}>
            {firstTitle === "Your first lesson" ? "See your first lesson" : "See your next lesson"}
          </Button>
        </section>
      ) : null}

      <section className="flex flex-col gap-3" aria-labelledby="swimmers">
        <h2 id="swimmers" className="font-heading text-big text-heading">
          Your swimmers
        </h2>
        {kids.map((k) => {
          const mine = lessons.filter((l) => l.child.id === k.id);
          const waits = data.waitlistEntries.filter((w) => w.childRecordId === k.id);
          return (
            <article key={k.id} className="flex flex-col gap-1 rounded-card bg-surface p-5 shadow-card" data-testid="home-child" aria-label={k.firstName}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-heading text-big text-heading">{k.firstName}</h3>
                <span data-testid="home-stage">{stageName(k.stageId) ?? "Stage set after the free evaluation"}</span>
              </div>
              {mine.map((l) => (
                <div key={l.enrollment.id} className="flex flex-col gap-1">
                  <p>
                    {l.lessonKind === "evaluation" ? `Free evaluation, ${longDate(l.firstLessonDate, today)}` : `${weekdayName(l.weekday)}s at ${clockTime(l.startTime)}`}, {l.pool.name}, Coach{" "}
                    {l.instructorFirstName}
                  </p>
                  <p>{lessonKindWords(l)}</p>
                  {l.bankCents !== null ? (
                    <p data-testid="home-prices">
                      <span className="font-strong">Bank draft {money(l.bankCents)}</span>, card {money(l.cardCents ?? l.bankCents)} a lesson
                    </p>
                  ) : (
                    <p className="font-strong">Never charged</p>
                  )}
                </div>
              ))}
              {waits.map((w) => {
                const cls = w.classId ? data.classes.find((c) => c.id === w.classId) : null;
                return <p key={w.id}>On the waitlist for {cls ? `${weekdayName(cls.weekday)}s at ${clockTime(cls.startTime)}` : "any time that fits"}.</p>;
              })}
            </article>
          );
        })}
      </section>

      <section className="flex flex-col gap-1 rounded-card bg-surface p-5 shadow-card" aria-labelledby="release-signed">
        <h2 id="release-signed" className="font-strong text-heading">
          Family release
        </h2>
        <p data-testid="home-release">
          {signature && version ? `You signed version ${version.number} on ${monthDayYear(todayAtSchool(new Date(signature.signedAt)))}.` : "Not signed yet."}
        </p>
      </section>

      <section className="flex flex-col gap-1 rounded-card bg-surface p-5 shadow-card" aria-labelledby="how-you-pay">
        <h2 id="how-you-pay" className="font-strong text-heading">
          How you pay
        </h2>
        <p data-testid="home-pay">{howTheyPay(data, family.id)}</p>
        {main?.kind === "bank" ? <p>A copy of your bank draft authorization is saved to your family&apos;s account.</p> : null}
      </section>

      <section className="flex flex-col gap-2 rounded-card border-2 border-dashed border-line p-5" aria-labelledby="add-child" data-testid="add-child-card">
        <Tag tone="highlight">Coming next</Tag>
        <h2 id="add-child" className="font-heading text-big text-heading">
          Add a child or a class
        </h2>
        <p>Here you&apos;ll be able to add a brother or sister, or another class time.</p>
      </section>
      {notes.length > 0 ? <p>{CLIPS_LATER_LINE}</p> : null}
    </ScreenShell>
  );
}
