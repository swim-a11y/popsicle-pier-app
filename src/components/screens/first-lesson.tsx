"use client";

import { LaneLine } from "@/components/parts/lane-line";
import { SkeletonRows } from "@/components/parts/skeleton";
import { Tag } from "@/components/parts/tag";
import { PageTitle, ScreenShell } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import {
  emailUsLine,
  emailUsLineFor,
  LESSON_LENGTH_LINE,
  RECORDED_LINE,
  SIBLINGS_LINE,
  UNDER_3_BRING_LINE,
  whatHappensLines,
  WHO_STAYS_LINE,
} from "@/content/first-lesson";
import {
  SIGNS_ON_PAPER,
  SWIM_DIAPER_LINE,
  relationshipLabel,
} from "@/content/sign-up";
import { useAppData } from "@/data/use-data";
import { useGo } from "@/lib/nav";
import {
  ageInMonths,
  clockTime,
  isThreeAndUnder,
  longDate,
} from "@/rules/dates";
import {
  currentFamily,
  nextLessonPerChild,
  poolsWithFirstVisitAhead,
} from "@/rules/family";
import { namesList } from "@/rules/release";
import { UNDER_3_MONTHS } from "@/rules/times";

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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
  const lessons = family ? nextLessonPerChild(data, family.id, today) : [];
  if (!family || lessons.length === 0) {
    return (
      <ScreenShell id="first-lesson">
        <PageTitle>Your first lesson</PageTitle>
        <p>
          Once you sign up, this page shows where to park, what to bring and who
          stays.
        </p>
        <Button size="block" onClick={() => go("/sign-up")}>
          Sign up for lessons
        </Button>
      </ScreenShell>
    );
  }

  const shown = lessons;
  const pools = [
    ...new Map(
      [
        ...shown.map((l) => l.pool),
        ...poolsWithFirstVisitAhead(data, family.id),
      ].map((p) => [p.id, p]),
    ).values(),
  ];
  const multi = pools.length > 1;
  const anyHeld = data.attendanceMarks.some((m) => m.familyId === family.id);
  const title =
    family.source === "moving-over" || anyHeld
      ? "Your next lesson"
      : "Your first lesson";
  const atPool = (poolId: string) =>
    shown
      .filter((l) => l.pool.id === poolId)
      .map((l) => ({
        name: l.child.firstName,
        months: ageInMonths(l.child.birthDate, l.date),
        inWater: l.parentInWater,
      }));
  const adults = data.listedAdults.filter((a) => a.familyId === family.id);
  const coaches = [...new Set(shown.map((l) => l.instructorFirstName))];
  // Who stays, worked out for the children at that pool.
  const staysAt = (poolId: string) => {
    const inWaterHere = atPool(poolId).filter(
      (a) => a.inWater && a.months < UNDER_3_MONTHS,
    );
    if (inWaterHere.length > 0)
      return `You, in the water with ${namesList(inWaterHere.map((a) => a.name))}. No drop-off.`;
    return adults.length > 0
      ? "You or a signed listed adult, the whole lesson. No drop-off."
      : "You, the whole lesson. No drop-off.";
  };

  return (
    <ScreenShell id="first-lesson">
      {/* Title, tickets and the at-a-glance box sit close so where, what and who fit the first screen. */}
      <div className="flex flex-col gap-3">
        <PageTitle>{title}</PageTitle>
        {shown.map((l) => (
          <section
            key={l.child.id}
            className="flex flex-col overflow-hidden rounded-card bg-surface shadow-card"
            aria-labelledby={`lesson-${l.child.id}`}
            data-testid="lesson-ticket"
          >
            <LaneLine />
            <div className="flex flex-col px-5 pt-3 pb-4">
              <p className="flex items-baseline justify-between gap-3 font-heading text-big text-heading">
                <span id={`lesson-${l.child.id}`}>{l.child.firstName}</span>
                <span data-testid="lesson-time">{clockTime(l.startTime)}</span>
              </p>
              <p
                className="font-heading text-big text-heading"
                data-testid="lesson-when"
              >
                {longDate(l.date, today)}
              </p>
              <p
                className="font-heading text-big text-heading"
                data-testid="lesson-where"
              >
                {l.pool.name}, Coach {l.instructorFirstName}
              </p>
              <p className="pt-1">{LESSON_LENGTH_LINE}</p>
            </div>
          </section>
        ))}

        {pools.map((pool) => {
          const here = atPool(pool.id);
          const waterHere = here.some(
            (a) => a.inWater && a.months < UNDER_3_MONTHS,
          );
          return (
            <div
              key={pool.id}
              className="flex flex-col gap-2 rounded-card bg-surface px-5 pt-3 pb-4 shadow-card"
              data-testid="at-a-glance"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-strong text-heading">
                  {multi ? `At a glance: ${pool.name}` : "At a glance"}
                </h2>
                <Tag>SAMPLE</Tag>
              </div>
              <dl className="flex flex-col gap-2">
                <Row label="Park">{pool.firstLesson.atAGlance.park}</Row>
                <Row label="Bring">
                  {waterHere
                    ? `${pool.firstLesson.atAGlance.bring}, and your own suit`
                    : pool.firstLesson.atAGlance.bring}
                </Row>
                <Row label="Stays">{staysAt(pool.id)}</Row>
              </dl>
            </div>
          );
        })}
      </div>

      {pools.map((pool) => {
        const here = atPool(pool.id);
        const name = multi ? `: ${pool.name}` : "";
        return (
          <div key={pool.id} className="flex flex-col gap-6">
            <section
              className="flex flex-col gap-2"
              aria-labelledby={`getting-there-${pool.id}`}
            >
              <div className="flex items-center gap-2">
                <h2
                  id={`getting-there-${pool.id}`}
                  className="font-heading text-big text-heading"
                >
                  Getting there{name}
                </h2>
                <Tag>SAMPLE</Tag>
              </div>
              <p data-testid="address">{pool.firstLesson.address}</p>
              <p data-testid="parking">{pool.firstLesson.parking}</p>
              <p data-testid="door">{pool.firstLesson.door}</p>
              <p data-testid="arrive">{pool.firstLesson.arrive}</p>
              <p>{pool.firstLesson.waitOnDeck}</p>
            </section>

            <section
              className="flex flex-col gap-2"
              aria-labelledby={`what-to-bring-${pool.id}`}
            >
              <div className="flex items-center gap-2">
                <h2
                  id={`what-to-bring-${pool.id}`}
                  className="font-heading text-big text-heading"
                >
                  What to bring{name}
                </h2>
                <Tag>SAMPLE</Tag>
              </div>
              <ul
                className="flex list-disc flex-col gap-1 pl-5"
                data-testid="bring"
              >
                {pool.firstLesson.bring.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              {here.some((a) => isThreeAndUnder(a.months)) ? (
                <p>{SWIM_DIAPER_LINE}</p>
              ) : null}
              {here.some((a) => a.inWater && a.months < UNDER_3_MONTHS) ? (
                <p className="font-strong">{UNDER_3_BRING_LINE}</p>
              ) : null}
            </section>
          </div>
        );
      })}

      <section
        className="flex flex-col gap-2"
        aria-labelledby="who-stays"
        data-testid="who-stays"
      >
        <h2 id="who-stays" className="font-heading text-big text-heading">
          Who stays
        </h2>
        <p>{WHO_STAYS_LINE}</p>
        {adults.map((a) => (
          <div
            key={a.id}
            className="flex flex-col gap-1 rounded-control bg-surface px-4 py-3 shadow-card"
            data-testid="listed-adult"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-strong">
                {a.firstName}, {relationshipLabel(a.relationship).toLowerCase()}
              </span>
              <Tag tone={a.status === "signed" ? "mark" : "plain"}>
                {a.status === "signed" ? "Signed" : "Waiting"}
              </Tag>
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
          {whatHappensLines(coaches.length === 1 ? coaches[0] : null).map(
            (line) => (
              <li key={line}>{line}</li>
            ),
          )}
        </ul>
      </section>

      {pools.map((pool) => (
        <p
          key={pool.id}
          className="rounded-card bg-surface px-4 py-3 shadow-card"
          data-testid="email-us"
        >
          {multi
            ? emailUsLineFor(pool.name, pool.schoolEmail)
            : emailUsLine(pool.schoolEmail)}
        </p>
      ))}
    </ScreenShell>
  );
}
