"use client";

import { SkeletonRows } from "@/components/parts/skeleton";
import { Tag } from "@/components/parts/tag";
import { PageTitle, ScreenShell } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import { emailUsLine, emailUsLineFor } from "@/content/first-lesson";
import type { AppData, DateOnly, OwedOffer } from "@/data/types";
import { useAppData } from "@/data/use-data";
import { useGo } from "@/lib/nav";
import { clockTime, longDate, weekdayName } from "@/rules/dates";
import { currentFamily, familyLessons, fillInOpen, lessonDaysAhead, lessonKindWords, oneOffGone, replacementLessons, upcomingLessons, type LessonInfo, type NextLesson } from "@/rules/family";
import { missNoted } from "@/rules/notes";
import { owedState } from "@/rules/owed";

const WEEKS = 6;

/** A new date or a fill-in, still to come: the pill first, then when and with whom, set in with the teal rule. */
function StandInBlock({ lesson, today, note }: { lesson: NextLesson; today: DateOnly; note?: string }) {
  return (
    <span className="mt-1 mb-2 flex flex-col items-start gap-1 border-l-4 border-mark pl-4" data-testid={lesson.fillIn ? "fill-in-day" : "owed-day"}>
      <Tag tone="mark">{lesson.fillIn ? "Fill-in" : "New date"}</Tag>
      <span className="font-strong">
        {longDate(lesson.date, today)} at {clockTime(lesson.startTime)} with Coach {lesson.instructorFirstName}
      </span>
      {note ? <span>{note}</span> : null}
    </span>
  );
}

/** A booked new date or fill-in that isn't coming after all, in a family's words; "" while it still stands. */
function goneWords(data: Readonly<AppData>, enrollmentId: string, fillIn: boolean, offer: OwedOffer, today: DateOnly): string {
  const gone = oneOffGone(data, { enrollmentId, fillIn, offer });
  const what = `${fillIn ? "the fill-in" : "its new date"} on ${longDate(offer.date, today)}`;
  if (gone?.kind === "cancelled") return `We cancelled ${what} too. Messages says what's next.`;
  if (gone?.kind === "closed") return `The pool is closed for ${what}.`;
  return "";
}

/** What a day the family said they'll miss means now: the note, and where its fill-in stands. */
function missLine(data: Readonly<AppData>, l: LessonInfo, date: DateOnly, extras: NextLesson[], today: DateOnly): string {
  const enrollmentId = l.enrollment.id;
  const f = data.fillIns.find((x) => x.enrollmentId === enrollmentId && x.missedDate === date);
  const sent = `You sent a note that ${l.child.firstName} will miss it.`;
  if (f?.offer.answer === "yes") {
    const gone = goneWords(data, enrollmentId, true, f.offer, today);
    if (gone) return `${sent} ${gone}`;
    // Shown under the day while it's to come; once it's marked held, it has happened.
    return extras.some((x) => x.fillIn && x.inPlaceOf === date) ? sent : `${sent} ${l.child.firstName}'s fill-in on ${longDate(f.offer.date, today)} has happened.`;
  }
  if (f?.offer.answer === "no") return `${sent} You said no, thanks, to the fill-in.`;
  if (f && fillInOpen(data, f, today)) return `${sent} Messages has a fill-in for you to answer.`;
  if (f) {
    const gone = oneOffGone(data, { enrollmentId, fillIn: true, offer: f.offer });
    if (gone?.kind === "cancelled") return `${sent} The fill-in we offered closed when we cancelled its day.`;
    if (gone?.kind === "closed") return `${sent} The fill-in we offered closed: the pool is closed that day.`;
    return `${sent} The fill-in we offered closed with no answer.`;
  }
  const note = data.familyNotes.find((n) => n.kind === "miss" && n.enrollmentId === enrollmentId && n.lessonDate === date);
  if (note?.readAt) return "We read your note. There's no fill-in for this one.";
  return sent;
}

/** Where the lesson owed for a cancelled date stands, in a family's words. */
function owedLine(data: Readonly<AppData>, enrollmentId: string, date: DateOnly, extras: NextLesson[], today: DateOnly): string {
  const owed = data.owedLessons.find((o) => o.enrollmentId === enrollmentId && o.cancelledDate === date);
  const state = owed ? owedState(data, owed, today) : null;
  if (state?.kind === "waiting") return "Messages has another date for you to answer.";
  if (state?.kind === "booked") {
    const gone = goneWords(data, enrollmentId, false, state.offer, today);
    if (gone) return gone;
    return extras.some((x) => !x.fillIn && x.inPlaceOf === date) ? "" : `Its new date, ${longDate(state.offer.date, today)}, has happened.`;
  }
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
        // New dates and fill-ins still to come for this class: the same list Home and Your first lesson read.
        const extras = replacementLessons(data, family.id, today).filter((x) => x.enrollment.id === l.enrollment.id);
        // One whose own day isn't in these weeks (it has passed, say) gets a row of its own, in date order.
        const loose = extras.filter((x) => !days.some((d) => d.date === x.inPlaceOf));
        const rows = [...days.map((d) => ({ date: d.date, day: d, lesson: null })), ...loose.map((x) => ({ date: x.date, day: null, lesson: x }))].sort((a, b) =>
          a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
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
              {l.lessonKind === "evaluation" && days.length === 0 ? <p data-testid="evaluation-done">The free evaluation was {longDate(l.firstLessonDate, today)}.</p> : null}
            </div>
            <ul className="flex flex-col gap-2">
              {rows.map(({ day: d, lesson }) =>
                lesson ? (
                  <li key={`${lesson.inPlaceOf}-${lesson.date}-${lesson.startTime}`} className="flex flex-col gap-1">
                    <StandInBlock
                      lesson={lesson}
                      today={today}
                      note={lesson.fillIn ? `A fill-in for the lesson on ${longDate(lesson.inPlaceOf!, today)}.` : `In place of the lesson we cancelled on ${longDate(lesson.inPlaceOf!, today)}.`}
                    />
                  </li>
                ) : !d ? null : d.closedReason ? (
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
                      We cancelled this lesson. {d.cancelledReason}.{owedLine(data, l.enrollment.id, d.date, extras, today) ? ` ${owedLine(data, l.enrollment.id, d.date, extras, today)}` : ""}
                    </span>
                    {extras
                      .filter((x) => !x.fillIn && x.inPlaceOf === d.date)
                      .map((x) => (
                        <StandInBlock key={`${x.date}-${x.startTime}`} lesson={x} today={today} />
                      ))}
                  </li>
                ) : missNoted(data, l.enrollment.id, d.date) ? (
                  <li key={d.date} className="flex flex-col gap-1" data-testid="missing-day">
                    <span className="font-strong">{longDate(d.date, today)}</span>
                    <Tag>Not coming</Tag>
                    <span>{missLine(data, l, d.date, extras, today)}</span>
                    {extras
                      .filter((x) => x.fillIn && x.inPlaceOf === d.date)
                      .map((x) => (
                        <StandInBlock key={`${x.date}-${x.startTime}`} lesson={x} today={today} />
                      ))}
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
