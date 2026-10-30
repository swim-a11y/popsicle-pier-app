"use client";

import { LaneLine } from "@/components/parts/lane-line";
import { SkeletonRows } from "@/components/parts/skeleton";
import { Tag } from "@/components/parts/tag";
import { PageTitle, ScreenShell } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import type { AppData, DateOnly } from "@/data/types";
import { useAppData } from "@/data/use-data";
import { useGo } from "@/lib/nav";
import { upcomingBills, type BillLine, type MonthBill } from "@/rules/bills";
import { clockTime, longDate, parseDate, weekdayName } from "@/rules/dates";
import { currentFamily } from "@/rules/family";
import { owedState } from "@/rules/owed";
import { cardAmountWords, money } from "@/rules/prices";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function monthName(month: DateOnly, today: DateOnly): string {
  const p = parseDate(month);
  return p.y === parseDate(today).y ? MONTHS[p.m - 1] : `${MONTHS[p.m - 1]} ${p.y}`;
}

/** "November 1, 8, 15 and 22" */
function daysWords(dates: DateOnly[]): string {
  const days = dates.map((d) => String(parseDate(d).d));
  const list = days.length > 1 ? `${days.slice(0, -1).join(", ")} and ${days[days.length - 1]}` : days[0];
  return `${MONTHS[parseDate(dates[0]).m - 1]} ${list}`;
}

function dayWords(d: DateOnly): string {
  return `${MONTHS[parseDate(d).m - 1]} ${parseDate(d).d}`;
}

/** What a lesson the school cancelled means for the bill. */
function cancelledWords(data: Readonly<AppData>, line: BillLine, date: DateOnly, credited: boolean, today: DateOnly): string {
  if (credited) return `${dayWords(date)}: we cancelled this lesson and credited it, so it isn't billed.`;
  const owed = data.owedLessons.find((o) => o.enrollmentId === line.lesson.enrollment.id && o.cancelledDate === date);
  const state = owed ? owedState(data, owed, today) : null;
  if (state?.kind === "booked") return `${dayWords(date)}: we cancelled this lesson. Its new date is ${longDate(state.offer.date, today)}.`;
  if (state?.kind === "closed") return `${dayWords(date)}: we cancelled this lesson. Neither date we offered worked, so it stays on the bill.`;
  return `${dayWords(date)}: we cancelled this lesson. It stays on the bill while we offer another date.`;
}

function Amounts({ bank, card, fee = 0, count, testId }: { bank: number; card: number; fee?: number; count?: { n: number; bankEach: number; cardEach: number } ; testId?: string }) {
  return (
    <span className="grid grid-cols-[auto_1fr] gap-x-4" data-testid={testId}>
      <span className="font-strong">Bank draft</span>
      <span>
        {money(bank)}
        {count ? `, ${count.n} at ${money(count.bankEach)}` : ""}
      </span>
      <span className="font-strong">Card</span>
      <span>
        {cardAmountWords(card - fee, fee)}
        {count ? `, ${count.n} at ${money(count.cardEach)}` : ""}
      </span>
    </span>
  );
}

function MonthCard({ data, bill, today }: { data: Readonly<AppData>; bill: MonthBill; today: DateOnly }) {
  const name = monthName(bill.month, today);
  const id = `bill-${bill.month}`;
  return (
    <article className="flex flex-col gap-4 overflow-hidden rounded-card bg-surface pb-5 shadow-card" aria-labelledby={id} data-testid="month-bill">
      <LaneLine />
      <div className="flex flex-col gap-1 px-5">
        <h2 id={id} className="font-heading text-big text-heading">
          {name}
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4">
          <dt className="font-strong">Bill date</dt>
          <dd data-testid="bill-date">{longDate(bill.billDate, today)}</dd>
          <dt className="font-strong">{bill.pays?.method === "card" ? "Card date" : "Draft date"}</dt>
          <dd data-testid="draft-date">{longDate(bill.draftDate, today)}</dd>
        </dl>
      </div>
      <ul className="flex flex-col gap-4 px-5">
        {bill.lines.map((line) => {
          const l = line.lesson;
          const fee = line.cardFeeEach * line.billed.length;
          return (
            <li key={l.enrollment.id} className="flex flex-col gap-1 border-t-2 border-line pt-4" data-testid="bill-line">
              <p className="font-heading text-big text-heading">{l.child.firstName}</p>
              <p>
                {weekdayName(l.weekday)}s at {clockTime(l.startTime)}, {l.pool.name}, Coach {l.instructorFirstName}
              </p>
              <p className="font-strong" data-testid="billed-dates">
                {line.billed.length === 0 ? "No lessons billed" : `${line.billed.length} ${line.billed.length === 1 ? "lesson" : "lessons"}: ${daysWords(line.billed)}`}
              </p>
              {line.closed.map((c) => (
                <p key={c.date} data-testid="not-billed">
                  {dayWords(c.date)}: {c.reason}. Not billed.
                </p>
              ))}
              {line.cancelled.map((c) => (
                <p key={c.date} data-testid="cancelled-billed">
                  {cancelledWords(data, line, c.date, c.credited, today)}
                </p>
              ))}
              <Amounts
                bank={line.bankCents}
                card={line.cardCents}
                fee={fee}
                count={line.billed.length > 0 ? { n: line.billed.length, bankEach: line.bankEach, cardEach: line.cardEach } : undefined}
                testId="line-prices"
              />
            </li>
          );
        })}
      </ul>
      <div className="mx-5 flex flex-col gap-2 border-t-2 border-line pt-4">
        <h3 className="font-strong text-heading">Total for {name}</h3>
        <Amounts bank={bill.bankCents} card={bill.cardCents} fee={bill.lines.reduce((s, l) => s + l.cardFeeEach * l.billed.length, 0)} testId="month-total" />
        {bill.pays ? (
          <p className="rounded-control bg-success px-3 py-2" data-testid="you-pay">
            {bill.pays.method === "bank"
              ? `You pay ${money(bill.pays.cents)} by bank draft, drafted on ${longDate(bill.draftDate, today)}.`
              : `You pay ${money(bill.pays.cents)} by card, charged on ${longDate(bill.draftDate, today)}.`}
          </p>
        ) : null}
      </div>
    </article>
  );
}

/** The Money room's parent side: each month's lessons, both prices on every line (lessons only, the owner's ruling). */
export function BillsScreen() {
  const loaded = useAppData();
  const go = useGo();
  if (!loaded) {
    return (
      <ScreenShell id="bills">
        <SkeletonRows rows={4} />
      </ScreenShell>
    );
  }
  const { data, today } = loaded;
  const family = currentFamily(data);
  const bills = family ? upcomingBills(data, family.id, today) : [];
  const moving = family?.source === "moving-over" && !family.movedOverAt;

  return (
    <ScreenShell id="bills">
      <PageTitle>Bills</PageTitle>
      {!family ? (
        <>
          <p>Once you sign up, each month&apos;s bill shows here, with the bank draft and card price on every line.</p>
          <Button size="block" onClick={() => go("/sign-up")}>
            Sign up for lessons
          </Button>
        </>
      ) : moving ? (
        <>
          <p>Your bills come here once you&apos;ve moved your family over and linked how you pay.</p>
          <Button size="block" onClick={() => go("/move-over")}>
            Continue moving over
          </Button>
        </>
      ) : bills.length === 0 ? (
        <p className="rounded-card bg-surface px-4 py-3 shadow-card">
          Nothing to bill. A free evaluation is never charged. Once a swimmer has a class, each month&apos;s bill shows here.
        </p>
      ) : (
        <>
          <p>Each month&apos;s bill reaches you by the 19th, at least 10 days before it&apos;s drafted on the 1st. Closed days aren&apos;t billed.</p>
          <div className="flex items-start gap-3 rounded-card bg-surface px-4 py-3 shadow-card">
            <Tag>SAMPLE</Tag>
            <p>Sample bills, worked out from your lesson dates. Nothing is ever charged in the sample.</p>
          </div>
          {bills.map((bill) => (
            <MonthCard key={bill.month} data={data} bill={bill} today={today} />
          ))}
        </>
      )}
    </ScreenShell>
  );
}
