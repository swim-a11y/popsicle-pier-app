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
import { currentFamily, familyChildren, familyLessons, lessonDaysAhead, lessonKindWords } from "@/rules/family";
import { missNoted } from "@/rules/notes";
import { bookedOwedDates, owedState } from "@/rules/owed";

const WEEKS = 6;

/** Where the lesson owed for a cancelled date stands, in a family's words. */
function owedLine(data: Readonly<AppData>, enrollmentId: string, date: DateOnly, today: DateOnly): string {
  const owed = data.owedLessons.find((o) => o.enrollmentId === enrollmentId && o.cancelledDate === date);
  const state = owed ? owedState(data, owed, today) : null;
  if (state?.kind === "waiting") return "Messages has another date for you to answer.";
  if (state?.kind === "booked") return `Its new date is ${longDate(state.offer.date, today)}.`;
  if (state?.kind === "credited") return "It's credited on your bill.";
  if (state?.kind === "closed") return "Neither date we offered worked.";
  return "A person at the school offers you another date.";
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
  const extra = familyChildren(data, family.id)
    .flatMap((k) => bookedOwedDates(data, k.id))
    .filter((x) => x.offer.date >= today);

  return (
    <ScreenShell id="lesson-dates">
      <PageTitle>Lesson dates</PageTitle>
      <p>The next few weeks for each swimmer. On a closed day there&apos;s no lesson, and it isn&apos;t billed.</p>
      {lessons.map((l) => {
        const days = lessonDaysAhead(data, l, today, WEEKS);
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
                    <span className="flex flex-wrap items-center gap-2">
                      <span>{longDate(d.date, today)}</span>
                      <Tag>Closed</Tag>
                    </span>
                    <span>{d.closedReason}</span>
                  </li>
                ) : d.cancelledReason ? (
                  <li key={d.date} className="flex flex-col gap-1" data-testid="cancelled-day">
                    <span className="flex flex-wrap items-center gap-2">
                      <span>{longDate(d.date, today)}</span>
                      <Tag>Cancelled</Tag>
                    </span>
                    <span>
                      We cancelled this lesson. {d.cancelledReason}. {owedLine(data, l.enrollment.id, d.date, today)}
                    </span>
                  </li>
                ) : missNoted(data, l.enrollment.id, d.date) ? (
                  <li key={d.date} className="flex flex-col gap-1" data-testid="missing-day">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-strong">{longDate(d.date, today)}</span>
                      <Tag>Missing</Tag>
                    </span>
                    <span>You sent a note that {l.child.firstName} will miss it.</span>
                  </li>
                ) : (
                  <li key={d.date} className="font-strong" data-testid="lesson-day">
                    {longDate(d.date, today)}
                  </li>
                ),
              )}
            </ul>
          </section>
        );
      })}
      {extra.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card" aria-labelledby="in-place" data-testid="owed-dates">
          <h2 id="in-place" className="font-heading text-big text-heading">
            In place of a cancelled lesson
          </h2>
          <ul className="flex flex-col gap-2">
            {extra.map(({ owed, offer, time }) => (
              <li key={`${owed.id}-${offer.date}`} className="flex flex-col gap-1">
                <span className="font-strong">
                  {data.children.find((c) => c.id === owed.childRecordId)?.firstName}, {longDate(offer.date, today)} at {clockTime(time.startTime)}
                </span>
                <span>
                  Coach {time.instructorFirstName}, {data.pools.find((p) => p.id === owed.poolId)?.name}. In place of {longDate(owed.cancelledDate, today)}.
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Button variant="secondary" size="block" onClick={() => go("/more/messages/new?kind=miss")}>
        Send a note about missing a lesson
      </Button>
      {pools.map((pool) => (
        <p key={pool.id} className="rounded-card bg-surface px-4 py-3 shadow-card" data-testid="email-us">
          {pools.length > 1 ? emailUsLineFor(pool.name, pool.schoolEmail) : emailUsLine(pool.schoolEmail)}
        </p>
      ))}
    </ScreenShell>
  );
}
