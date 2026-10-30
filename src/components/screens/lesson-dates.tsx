"use client";

import { SkeletonRows } from "@/components/parts/skeleton";
import { Tag } from "@/components/parts/tag";
import { PageTitle, ScreenShell } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import { emailUsLine, emailUsLineFor } from "@/content/first-lesson";
import type { AppData, DateOnly } from "@/data/types";
import { useAppData } from "@/data/use-data";
import { useGo } from "@/lib/nav";
import { clockTime, longDate, weekdayName } from "@/rules/dates";
import { currentFamily, familyLessons, lessonDaysAhead, lessonKindWords, upcomingLessons } from "@/rules/family";
import { missNoted } from "@/rules/notes";
import { offerOpen } from "@/rules/holds";
import { bookedOwedDates, owedState } from "@/rules/owed";

const WEEKS = 6;

/** A lesson standing in for the day above it: the pill first, then when and with whom, set in with the teal rule. */
function StandInBlock({ label, date, time, coach, today, testId }: { label: string; date: DateOnly; time: string | undefined; coach: string; today: DateOnly; testId: string }) {
  return (
    <span className="mt-1 mb-2 flex flex-col items-start gap-1 border-l-4 border-mark pl-4" data-testid={testId}>
      <Tag tone="mark">{label}</Tag>
      <span className="font-strong">
        {longDate(date, today)}
        {time ? ` at ${clockTime(time)}` : ""} with Coach {coach}
      </span>
    </span>
  );
}

/** A missed lesson's fill-in, if one was offered. */
function fillInFor(data: Readonly<AppData>, enrollmentId: string, date: DateOnly) {
  return data.fillIns.find((f) => f.enrollmentId === enrollmentId && f.missedDate === date);
}

/** What a day the family said they'll miss means now: the note, and where its fill-in stands. */
function missLine(data: Readonly<AppData>, enrollmentId: string, date: DateOnly, name: string, today: DateOnly): string {
  const f = fillInFor(data, enrollmentId, date);
  const sent = `You sent a note that ${name} will miss it.`;
  if (f?.offer.answer === "yes") return sent;
  if (f?.offer.answer === "no") return `${sent} You said no, thanks, to the fill-in.`;
  if (f && offerOpen(f.offer, today)) return `${sent} Messages has a fill-in for you to answer.`;
  if (f) return `${sent} The fill-in we offered closed with no answer.`;
  const note = data.familyNotes.find((n) => n.kind === "miss" && n.enrollmentId === enrollmentId && n.lessonDate === date);
  if (note?.readAt) return "We read your note. There's no fill-in for this one.";
  return sent;
}

/** A booked fill-in, as a row right under the day it stands in for. */
function fillInRow(data: Readonly<AppData>, enrollmentId: string, date: DateOnly, today: DateOnly) {
  const f = fillInFor(data, enrollmentId, date);
  if (!f || f.offer.answer !== "yes" || f.offer.date < today) return null;
  const time = (f.offer.timeKind === "class" ? data.classes.find((c) => c.id === f.offer.timeId) : data.evaluationTimes.find((e) => e.id === f.offer.timeId))?.startTime;
  return <StandInBlock label="Fill-in" date={f.offer.date} time={time} coach={f.instructorFirstName} today={today} testId="fill-in-day" />;
}

/** Where the lesson owed for a cancelled date stands, in a family's words. */
function owedLine(data: Readonly<AppData>, enrollmentId: string, date: DateOnly, today: DateOnly): string {
  const owed = data.owedLessons.find((o) => o.enrollmentId === enrollmentId && o.cancelledDate === date);
  const state = owed ? owedState(data, owed, today) : null;
  if (state?.kind === "waiting") return "Messages has another date for you to answer.";
  if (state?.kind === "booked") return "";
  if (state?.kind === "credited") return "It's credited on your bill.";
  if (state?.kind === "closed") return "Neither date we offered worked.";
  if (state?.kind === "no-opening") return "A person at the school is checking what's open.";
  return "A person at the school is choosing a new date.";
}

/** The parent's side of the Schedule room: each swimmer's weeks ahead, closed days marked. */
export function LessonDatesScreen() {
  const loaded = useAppData();
  const go = useGo();
  if (!loaded) {
    return (
      <ScreenShell id="lesson-dates">
        <SkeletonRows rows={4} />
      </ScreenShell>
    );
  }
  const { data, today } = loaded;
  const family = currentFamily(data);
  const lessons = family ? familyLessons(data, family.id) : [];
  if (!family || lessons.length === 0) {
    return (
      <ScreenShell id="lesson-dates">
        <PageTitle>Lesson dates</PageTitle>
        <p>Once you sign up, each swimmer&apos;s dates show here, with any days the pool is closed.</p>
        <Button size="block" onClick={() => go("/sign-up")}>
          Sign up for lessons
        </Button>
      </ScreenShell>
    );
  }
  const pools = [...new Map(lessons.map((l) => [l.pool.id, l.pool])).values()];

  return (
    <ScreenShell id="lesson-dates">
      <PageTitle>Lesson dates</PageTitle>
      <p>The next few weeks for each swimmer. On a closed day there&apos;s no lesson, and it isn&apos;t billed.</p>
      {lessons.map((l) => {
        const days = lessonDaysAhead(data, l, today, WEEKS);
        // Dates booked in place of this class's cancelled lessons, still to come.
        const newDates = bookedOwedDates(data, l.child.id).filter((x) => x.owed.enrollmentId === l.enrollment.id && x.offer.date >= today);
        const newDateRow = (x: (typeof newDates)[number]) => (
          <StandInBlock key={`${x.owed.id}-${x.offer.date}`} label="New date" date={x.offer.date} time={x.time.startTime} coach={x.time.instructorFirstName} today={today} testId="owed-day" />
        );
        // A day with another lesson for this swimmer too (a new date or a fill-in) shows each one's time.
        const otherLessons = upcomingLessons(data, family.id, today).filter((x) => x.child.id === l.child.id && x.inPlaceOf);
        const otherLessonDays = new Set(otherLessons.map((x) => x.date));
        return (
          <section key={l.enrollment.id} className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card" aria-labelledby={`dates-${l.enrollment.id}`} data-testid="lesson-dates">
            <div className="flex flex-col gap-1">
              <h2 id={`dates-${l.enrollment.id}`} className="font-heading text-big text-heading">
                {l.child.firstName}
              </h2>
              <p>
                {l.lessonKind === "evaluation" ? "Free evaluation" : `${weekdayName(l.weekday)}s at ${clockTime(l.startTime)}`}, {l.pool.name}, Coach {l.instructorFirstName}
              </p>
              <p>{lessonKindWords(l)}</p>
            </div>
            <ul className="flex flex-col gap-2">
              {days.map((d) =>
                d.closedReason ? (
                  <li key={d.date} className="flex flex-col gap-1" data-testid="closed-day">
                    <span>{longDate(d.date, today)}</span>
                    <Tag>Closed</Tag>
                    <span>{d.closedReason}</span>
                  </li>
                ) : d.cancelledReason ? (
                  <li key={d.date} className="flex flex-col gap-1" data-testid="cancelled-day">
                    <span>{longDate(d.date, today)}</span>
                    <Tag>Cancelled</Tag>
                    <span>
                      We cancelled this lesson. {d.cancelledReason}.{owedLine(data, l.enrollment.id, d.date, today) ? ` ${owedLine(data, l.enrollment.id, d.date, today)}` : ""}
                    </span>
                    {newDates.filter((x) => x.owed.cancelledDate === d.date).map((x) => newDateRow(x))}
                  </li>
                ) : missNoted(data, l.enrollment.id, d.date) ? (
                  <li key={d.date} className="flex flex-col gap-1" data-testid="missing-day">
                    <span className="font-strong">{longDate(d.date, today)}</span>
                    <Tag>Not coming</Tag>
                    <span>{missLine(data, l.enrollment.id, d.date, l.child.firstName, today)}</span>
                    {fillInRow(data, l.enrollment.id, d.date, today)}
                  </li>
                ) : (
                  <li key={d.date} className="flex flex-col gap-1" data-testid="lesson-day">
                    <span className="font-strong">
                      {longDate(d.date, today)}
                      {otherLessonDays.has(d.date) ? ` at ${clockTime(l.startTime)}` : ""}
                    </span>
                    {otherLessons
                      .filter((x) => x.date === d.date)
                      .map((x) => (
                        <span key={`${x.enrollment.id}-${x.startTime}`}>
                          {l.child.firstName} also has a {x.fillIn ? "fill-in" : "new date"} at {clockTime(x.startTime)}
                          {x.pool.id !== l.pool.id ? ` at ${x.pool.name}` : ""} that day.
                        </span>
                      ))}
                  </li>
                ),
              )}
              {/* A new date whose cancelled lesson is no longer in these weeks. */}
              {newDates.filter((x) => !days.some((d) => d.date === x.owed.cancelledDate)).map((x) => (
                <li key={`${x.owed.id}-${x.offer.date}`} className="flex flex-col gap-1">
                  {newDateRow(x)}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <Button variant="secondary" size="block" onClick={() => go("/more/messages/new?kind=miss")}>
        Send a note about missing a lesson
      </Button>
      {pools.map((pool) => (
        <p key={pool.id} data-testid="email-us">
          {pools.length > 1 ? emailUsLineFor(pool.name, pool.schoolEmail) : emailUsLine(pool.schoolEmail)}
        </p>
      ))}
    </ScreenShell>
  );
}
