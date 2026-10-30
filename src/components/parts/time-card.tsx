import { PriceRows } from "@/components/parts/price-rows";
import { NO_PARTNER_YET } from "@/content/sign-up";
import { clockTime, longDate, weekdayName } from "@/rules/dates";
import type { TimeOption } from "@/rules/times";

export function ageWords(months: number): string {
  return months % 12 === 0 ? `${months / 12}` : `${Math.floor(months / 12)} and a half`;
}

function kindWords(o: TimeOption): string {
  if (o.lessonKind === "evaluation") return `Free evaluation with Coach ${o.instructorFirstName}`;
  if (o.lessonKind === "private") return `Private with Coach ${o.instructorFirstName}`;
  return `Semi-private with Coach ${o.instructorFirstName}`;
}

/** What a parent needs to pick a time: first date, kind and coach, both prices (bank draft first), sibling mark, the no-partner words. */
export function TimeDetails({ o, today }: { o: TimeOption; today: string }) {
  return (
    <>
      {o.kind === "class" ? <span className="block">First lesson {longDate(o.firstLessonDate, today)}</span> : null}
      <span className="block">{kindWords(o)}</span>
      {o.parentInWater ? <span className="block">You&apos;re in the water too.</span> : null}
      {o.bankCents !== null ? <PriceRows bankCents={o.bankCents} testId="prices" /> : <span className="block font-strong">Never charged</span>}
      {o.sibling ? (
        <span className="mt-1 inline-flex self-start rounded-pill bg-mark px-3 py-0.5 font-strong text-on-mark">
          {o.sibling.relation === "same-time" ? `Same time as ${o.sibling.name}'s lesson` : `Next to ${o.sibling.name}'s lesson`}
        </span>
      ) : null}
      {o.noPartnerYet ? <span className="mt-1 block rounded-control bg-page px-3 py-2">{NO_PARTNER_YET}</span> : null}
    </>
  );
}

export function timeTitle(o: TimeOption, today: string): string {
  return o.kind === "evaluation" ? `${longDate(o.firstLessonDate, today)} at ${clockTime(o.startTime)}` : `${weekdayName(o.weekday)}s at ${clockTime(o.startTime)}`;
}
