"use client";

import { SkeletonRows } from "@/components/parts/skeleton";
import { Tag } from "@/components/parts/tag";
import { PageTitle, ScreenShell } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import { emailUsLine } from "@/content/first-lesson";
import { useAppData } from "@/data/use-data";
import { useGo } from "@/lib/nav";
import { clockTime, longDate, weekdayName } from "@/rules/dates";
import { currentFamily, familyLessons, lessonDaysAhead, lessonKindWords } from "@/rules/family";

const WEEKS = 8;

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
  const pool = data.pools.find((p) => p.id === family.homePoolId) ?? lessons[0].pool;

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
            <ul className="flex flex-col">
              {days.map((d) => (
                <li key={d.date} className="flex flex-col gap-1 border-t-2 border-line py-2" data-testid={d.closedReason ? "closed-day" : "lesson-day"}>
                  <span className="flex items-center justify-between gap-2">
                    <span className={d.closedReason ? "" : "font-strong"}>{longDate(d.date, today)}</span>
                    {d.closedReason ? <Tag>Closed</Tag> : <span>{clockTime(l.startTime)}</span>}
                  </span>
                  {d.closedReason ? (
                    <span>
                      {d.closedReason}. No lesson, and it isn&apos;t billed.
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="rounded-card bg-surface px-4 py-3 shadow-card">{emailUsLine(pool.schoolEmail)}</p>
    </ScreenShell>
  );
}
