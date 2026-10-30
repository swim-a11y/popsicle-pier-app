"use client";

import { LaneLine } from "@/components/parts/lane-line";
import { SkeletonRows } from "@/components/parts/skeleton";
import { Tag } from "@/components/parts/tag";
import { PageTitle, ScreenShell } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import {
  emailUsLine,
  LESSON_LENGTH_LINE,
  RECORDED_LINE,
  SIBLINGS_LINE,
  UNDER_3_BRING_LINE,
  whatHappensLines,
  WHO_STAYS_LINE,
} from "@/content/first-lesson";
import { SIGNS_ON_PAPER, SWIM_DIAPER_LINE, relationshipLabel } from "@/content/sign-up";
import { useAppData } from "@/data/use-data";
import { useGo } from "@/lib/nav";
import { ageInMonths, clockTime, isThreeAndUnder, longDate } from "@/rules/dates";
import { currentFamily, lessonPerChild, upcomingLessonDate } from "@/rules/family";
import { namesList } from "@/rules/release";
import { UNDER_3_MONTHS } from "@/rules/times";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[3.5rem_1fr] gap-x-3">
      <dt className="font-strong text-heading">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Where, what and who at a glance: one section per child, the shared notes once. */
export function FirstLessonScreen() {
  const loaded = useAppData();
  const go = useGo();
  if (!loaded) {
    return (
      <ScreenShell id="first-lesson">
        <SkeletonRows rows={3} />
      </ScreenShell>
    );
  }
  const { data, today } = loaded;
  const family = currentFamily(data);
  const lessons = family ? lessonPerChild(data, family.id) : [];
  if (!family || lessons.length === 0) {
    return (
      <ScreenShell id="first-lesson">
        <PageTitle>Your first lesson</PageTitle>
        <p>Once you sign up, this page shows where to park, what to bring and who stays.</p>
        <Button size="block" onClick={() => go("/sign-up")}>
          Sign up for lessons
        </Button>
      </ScreenShell>
    );
  }

  const pool = data.pools.find((p) => p.id === lessons[0].pool.id)!;
  const shown = lessons.map((l) => ({ ...l, date: upcomingLessonDate(data, l, today) }));
  const anyHeld = data.attendanceMarks.some((m) => m.familyId === family.id);
  const title = family.source === "moving-over" || anyHeld ? "Your next lesson" : "Your first lesson";
  const ages = shown.map((l) => ({ name: l.child.firstName, months: ageInMonths(l.child.birthDate, l.date), inWater: l.parentInWater }));
  const inWater = ages.filter((a) => a.inWater && a.months < UNDER_3_MONTHS);
  const threeAndUnder = ages.some((a) => isThreeAndUnder(a.months));
  const adults = data.listedAdults.filter((a) => a.familyId === family.id);
  const coaches = [...new Set(shown.map((l) => l.instructorFirstName))];
  const stays =
    inWater.length > 0
      ? `You, in the water with ${namesList(inWater.map((a) => a.name))}. No drop-off.`
      : adults.length > 0
        ? "You or a signed listed adult, the whole lesson. No drop-off."
        : "You, the whole lesson. No drop-off.";

  return (
    <ScreenShell id="first-lesson">
      <PageTitle>{title}</PageTitle>
      {shown.map((l) => (
        <section key={l.child.id} className="flex flex-col overflow-hidden rounded-card bg-surface shadow-card" aria-labelledby={`lesson-${l.child.id}`} data-testid="lesson-ticket">
          <LaneLine />
          <div className="flex flex-col px-5 pt-3 pb-4">
            <p className="flex items-baseline justify-between gap-3 font-heading text-big text-heading">
              <span id={`lesson-${l.child.id}`}>{l.child.firstName}</span>
              <span data-testid="lesson-time">{clockTime(l.startTime)}</span>
            </p>
            <p className="font-heading text-big text-heading" data-testid="lesson-when">
              {longDate(l.date, today)}
            </p>
            <p className="font-heading text-big text-heading" data-testid="lesson-where">
              {l.pool.name}, Coach {l.instructorFirstName}
            </p>
            <p className="pt-1">{LESSON_LENGTH_LINE}</p>
          </div>
        </section>
      ))}

      <dl className="flex flex-col gap-2 rounded-card bg-surface px-5 py-4 shadow-card" aria-label="At a glance" data-testid="at-a-glance">
        <Row label="Park">{pool.firstLesson.atAGlance.park}</Row>
        <Row label="Bring">{inWater.length > 0 ? `${pool.firstLesson.atAGlance.bring}, and your own suit` : pool.firstLesson.atAGlance.bring}</Row>
        <Row label="Stays">{stays}</Row>
      </dl>

      <section className="flex flex-col gap-2" aria-labelledby="getting-there">
        <div className="flex items-center gap-2">
          <h2 id="getting-there" className="font-heading text-big text-heading">
            Getting there
          </h2>
          <Tag>SAMPLE</Tag>
        </div>
        <p data-testid="address">{pool.firstLesson.address}</p>
        <p data-testid="parking">{pool.firstLesson.parking}</p>
        <p data-testid="door">{pool.firstLesson.door}</p>
        <p data-testid="arrive">{pool.firstLesson.arrive}</p>
        <p>{pool.firstLesson.waitOnDeck}</p>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="what-to-bring">
        <div className="flex items-center gap-2">
          <h2 id="what-to-bring" className="font-heading text-big text-heading">
            What to bring
          </h2>
          <Tag>SAMPLE</Tag>
        </div>
        <ul className="flex list-disc flex-col gap-1 pl-5" data-testid="bring">
          {pool.firstLesson.bring.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        {threeAndUnder ? <p>{SWIM_DIAPER_LINE}</p> : null}
        {inWater.length > 0 ? <p className="font-strong">{UNDER_3_BRING_LINE}</p> : null}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="who-stays" data-testid="who-stays">
        <h2 id="who-stays" className="font-heading text-big text-heading">
          Who stays
        </h2>
        <p>{WHO_STAYS_LINE}</p>
        {adults.map((a) => (
          <div key={a.id} className="flex flex-col gap-1 rounded-control bg-surface px-4 py-3 shadow-card" data-testid="listed-adult">
            <div className="flex items-center justify-between gap-2">
              <span className="font-strong">
                {a.firstName}, {relationshipLabel(a.relationship).toLowerCase()}
              </span>
              <Tag tone={a.status === "signed" ? "mark" : "plain"}>{a.status === "signed" ? "Signed" : "Waiting"}</Tag>
            </div>
            {a.status === "waiting" ? <p>{SIGNS_ON_PAPER}</p> : null}
          </div>
        ))}
        <p>{SIBLINGS_LINE}</p>
        <p>{RECORDED_LINE}</p>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="what-happens">
        <div className="flex items-center gap-2">
          <h2 id="what-happens" className="font-heading text-big text-heading">
            What happens
          </h2>
          <Tag>SAMPLE</Tag>
        </div>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {whatHappensLines(coaches.length === 1 ? coaches[0] : null).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <p className="rounded-card bg-surface px-4 py-3 shadow-card" data-testid="email-us">
        {emailUsLine(pool.schoolEmail)}
      </p>
    </ScreenShell>
  );
}
