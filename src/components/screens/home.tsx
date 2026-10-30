"use client";

import { useEffect, useRef, useState } from "react";

import { NoteCard } from "@/components/parts/note-card";
import { PriceRows } from "@/components/parts/price-rows";
import { SkeletonRows } from "@/components/parts/skeleton";
import { PageTitle, ScreenShell } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import { SCHOOL_NAME } from "@/content/brand";
import { CLIPS_LATER_LINE } from "@/content/first-lesson";
import { SOMEONE_WILL_TALK } from "@/content/sign-up";
import { stageName } from "@/content/path";
import { getStore } from "@/data/app-store";
import type { AppData, DateOnly, WaitlistEntry } from "@/data/types";
import { useAppData } from "@/data/use-data";
import { useGo } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { clockTime, longDate, monthDayYear, todayAtSchool, weekdayName } from "@/rules/dates";
import { approvedNotesForFamily } from "@/rules/first-sunday";
import { currentFamily, familyChildren, familyLessons, familyPayment, howTheyPay, lessonInfo, lessonKindWords, upcomingLessons } from "@/rules/family";
import { offerOpen } from "@/rules/holds";
import { leaveWaitlist } from "@/rules/offers";
import { answersWaiting } from "@/rules/owed";
import { latestSignature } from "@/rules/release";

/** "On the waitlist for Sundays at 9:00 am." The family can leave it themselves, after a confirm. */
function WaitlistLine({ data, familyId, entry, childFirstName, today }: { data: Readonly<AppData>; familyId: string; entry: WaitlistEntry; childFirstName: string; today: DateOnly }) {
  const go = useGo();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const stay = useRef<HTMLButtonElement>(null);
  const cls = entry.classId ? data.classes.find((c) => c.id === entry.classId) : null;
  const pool = data.pools.find((p) => p.id === entry.poolId);
  const what = `${cls ? `${weekdayName(cls.weekday)}s at ${clockTime(cls.startTime)}` : "any time that fits"}${pool ? ` at ${pool.name}` : ""}`;
  // The question comes into view above the tab bar, with the answer that changes nothing ready.
  useEffect(() => {
    if (!asking) return;
    panel.current?.scrollIntoView?.({ block: "nearest" });
    stay.current?.focus({ preventScroll: true });
  }, [asking]);
  const offered = data.waitlistOffers.some((o) => o.waitlistEntryId === entry.id && offerOpen(o, today));
  const leave = async () => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await getStore().transaction((tx) => leaveWaitlist(tx, { entryId: entry.id, familyId, today: todayAtSchool(new Date()) }));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "That didn't save. Please try again.");
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 border-t-2 border-line pt-3" data-testid="home-waitlist">
      <p>On the waitlist for {what}.</p>
      {offered ? (
        <Button variant="quiet" size="small" className="h-auto self-start px-0 text-left whitespace-normal" onClick={() => go("/more/messages")}>
          The school offered a spot. Answer it in Messages.
        </Button>
      ) : asking ? (
        <div ref={panel} className="flex flex-col gap-3 rounded-control bg-page px-3 py-3" data-testid="leave-confirm">
          <p className="font-strong">Take {childFirstName} off the waitlist for {what}?</p>
          <Button ref={stay} size="block" disabled={busy} onClick={() => setAsking(false)}>
            Stay on it
          </Button>
          <Button variant="secondary" size="block" disabled={busy} onClick={() => void leave()}>
            {busy ? "Saving..." : "Leave the waitlist"}
          </Button>
        </div>
      ) : (
        <Button variant="quiet" size="small" className="self-start px-0" onClick={() => setAsking(true)}>
          Leave this waitlist
        </Button>
      )}
      {problem ? <p className="rounded-control bg-notice px-3 py-2">{problem}</p> : null}
    </div>
  );
}

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

  const notes = approvedNotesForFamily(data, family.id);
  const signature = latestSignature(data, family.id);
  const version = signature ? data.releaseVersions.find((v) => v.id === signature.versionId) : undefined;
  const { main } = familyPayment(data, family.id);
  const movingNotDone = family.source === "moving-over" && !family.movedOverAt;
  // Soonest first, and by time on the same day, so each child keeps their own time and coach.
  // A date booked in place of a cancelled lesson counts too.
  const upcoming = upcomingLessons(data, family.id, today);
  const next = upcoming[0];
  const sameDay = next ? upcoming.filter((l) => l.date === next.date) : [];
  const mixedPools = new Set(sameDay.map((l) => l.pool.id)).size > 1;
  const waiting = answersWaiting(data, family.id, today);
  const firstTitle = family.source === "moving-over" || data.attendanceMarks.some((m) => m.familyId === family.id) ? "Your next lesson" : "Your first lesson";

  return (
    <ScreenShell id="parent-home">
      <PageTitle>Hi, {family.parentFullName.split(" ")[0]}</PageTitle>

      {/* An answer the school is waiting for comes first: it has a day to answer by. */}
      {waiting.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card" aria-labelledby="needs-answer" data-testid="home-needs-answer">
          <h2 id="needs-answer" className="font-heading text-big text-heading">
            The school needs your answer
          </h2>
          {waiting.map((w) => (
            <p key={w.id}>
              {w.kind === "waitlist"
                ? w.asked
                  ? `A different time for ${w.childFirstName}`
                  : `A spot opened for ${w.childFirstName}`
                : w.kind === "fill-in"
                  ? `A fill-in for ${w.childFirstName}'s missed lesson`
                  : `A new date for ${w.childFirstName}'s cancelled lesson`}
              . Please answer by {longDate(w.answerBy, today)}.
            </p>
          ))}
          <Button size="block" onClick={() => go("/more/messages")}>
            {waiting.length > 1
              ? "Open Messages"
              : waiting[0].kind === "waitlist"
                ? waiting[0].asked
                  ? `See ${waiting[0].childFirstName}'s new time`
                  : `See ${waiting[0].childFirstName}'s spot`
                : waiting[0].kind === "fill-in"
                  ? `See ${waiting[0].childFirstName}'s fill-in`
                  : `See ${waiting[0].childFirstName}'s new date`}
          </Button>
        </section>
      ) : null}

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
          {sameDay.length === 1 ? (
            <>
              <p className="font-heading text-big text-heading">
                {longDate(next.date, today)}, {clockTime(next.startTime)}
              </p>
              <p>
                {next.child.firstName} at {next.pool.name} with Coach {next.instructorFirstName}
              </p>
              {next.inPlaceOf ? (
                <p data-testid="home-in-place">
                  {next.fillIn ? "A fill-in for the lesson on" : "In place of the lesson we cancelled on"} {longDate(next.inPlaceOf, today)}.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="font-heading text-big text-heading">{longDate(next.date, today)}</p>
              <ul className="flex flex-col gap-1" data-testid="home-lead-children">
                {sameDay.map((l) => (
                  <li key={`${l.enrollment.id}-${l.startTime}`}>
                    <span className="font-strong">{l.child.firstName}</span>, {clockTime(l.startTime)} with Coach {l.instructorFirstName}
                    {mixedPools ? ` at ${l.pool.name}` : ""}
                    {l.inPlaceOf ? `, ${l.fillIn ? "a fill-in for the lesson on" : "in place of the lesson we cancelled on"} ${longDate(l.inPlaceOf, today)}` : ""}
                  </li>
                ))}
              </ul>
              {mixedPools ? null : <p>At {next.pool.name}</p>}
            </>
          )}
          <Button size="block" variant={waiting.length > 0 ? "secondary" : "primary"} onClick={() => go("/first-lesson")}>
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
              {mine.map((l, i) => {
                // A class the family moved to from another one: say so until its first lesson.
                const switched = data.waitlistOffers.find((o) => o.enrollmentId === l.enrollment.id && o.answer === "yes" && o.inPlaceOfEnrollmentId);
                const was = switched && today <= l.firstLessonDate ? data.enrollments.find((e) => e.id === switched.inPlaceOfEnrollmentId) : undefined;
                const wasInfo = was ? lessonInfo(data, was) : null;
                return (
                  <div key={l.enrollment.id} className={cn("flex flex-col gap-1", i > 0 && "mt-2 border-t border-line pt-3")} data-testid="home-class">
                    <p className="font-strong">
                      {l.lessonKind === "evaluation" ? `Free evaluation, ${longDate(l.firstLessonDate, today)}` : `${weekdayName(l.weekday)}s at ${clockTime(l.startTime)}`}, {l.pool.name}, Coach{" "}
                      {l.instructorFirstName}
                    </p>
                    <p>{lessonKindWords(l)}</p>
                    {l.bankCents !== null ? (
                      <PriceRows bankCents={l.bankCents} testId="home-prices" />
                    ) : (
                      <p className="font-strong">Never charged</p>
                    )}
                    {wasInfo ? (
                      <p data-testid="home-switched">
                        New class from {longDate(l.firstLessonDate, today)}. The {weekdayName(wasInfo.weekday)} {clockTime(wasInfo.startTime)} class at {wasInfo.pool.name} has ended.
                      </p>
                    ) : null}
                  </div>
                );
              })}
              {k.flaggedForPerson ? (
                <p className="rounded-control bg-success px-3 py-2" data-testid="home-talk">
                  {SOMEONE_WILL_TALK}
                </p>
              ) : null}
              {waits.map((w) => (
                <WaitlistLine key={w.id} data={data} familyId={family.id} entry={w} childFirstName={k.firstName} today={today} />
              ))}
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

      <section className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card" aria-label="Add a child or a class" data-testid="add-child-card">
        <p>A brother or sister, or another class time at either pool.</p>
        <Button variant="secondary" size="block" onClick={() => go("/family/add")}>
          Add a child or a class
        </Button>
      </section>
      {notes.length > 0 ? <p>{CLIPS_LATER_LINE}</p> : null}
    </ScreenShell>
  );
}
