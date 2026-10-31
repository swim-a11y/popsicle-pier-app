"use client";

import { LaneLine } from "@/components/parts/lane-line";
import { PriceRows } from "@/components/parts/price-rows";
import { SkeletonRows } from "@/components/parts/skeleton";
import { Tag } from "@/components/parts/tag";
import { PageTitle, ScreenShell } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import type { AppData, DateOnly } from "@/data/types";
import { useAppData } from "@/data/use-data";
import { useGo } from "@/lib/nav";
import { upcomingBills, type BillLine, type MonthBill } from "@/rules/bills";
import { clockTime, longDate, parseDate, weekdayName } from "@/rules/dates";
import { currentFamily, oneOffGone, oneOffOfOwed } from "@/rules/family";
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

/** What a lesson the school cancelled means for the bill. Describes where it stands; never promises a date. */
function cancelledWords(data: Readonly<AppData>, line: BillLine, date: DateOnly, credited: boolean, today: DateOnly): string {
  if (credited) return `${dayWords(date)}: we cancelled this lesson and credited it, so it isn't billed.`;
  // The lessons owed for it: the first, then one more each time we cancelled the new date booked for it too.
  const chain = data.owedLessons
    .filter((o) => o.enrollmentId === line.lesson.enrollment.id && o.billedDate === date)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  const latest = chain[chain.length - 1];
  const state = latest ? owedState(data, latest, today) : null;
  const what = chain.length > 1 ? `${dayWords(date)}: we cancelled this lesson, and then its new date, ${longDate(latest.cancelledDate, today)}, too.` : `${dayWords(date)}: we cancelled this lesson.`;
  if (state?.kind === "booked") {
    const gone = oneOffGone(data, oneOffOfOwed(latest, state.offer));
    if (gone?.kind === "cancelled") return `${what} Its new date, ${longDate(state.offer.date, today)}, was cancelled too. It stays on the bill for now.`;
    if (gone?.kind === "closed") return `${what} The pool is closed on its new date, ${longDate(state.offer.date, today)}. It stays on the bill for now.`;
    return `${what} Its new date is ${longDate(state.offer.date, today)}.`;
  }
  if (state?.kind === "closed") return `${what} Neither date we offered worked, so it stays on the bill.`;
  if (state?.kind === "waiting") return `${what} It stays on the bill for now; Messages has a new date for you to answer.`;
  return `${what} It stays on the bill for now.`;
}

function Amounts({ bank, card, fee = 0, count, testId }: { bank: number; card: number; fee?: number; count?: { n: number; bankEach: number; cardEach: number }; testId?: string }) {
  return (
    <span className="grid grid-cols-[auto_1fr] gap-x-4" data-testid={testId}>
      <span>Bank draft</span>
      <span>
        <span className="font-strong">{money(bank)}</span>
        {count ? `, ${count.n} at ${money(count.bankEach)}` : ""}
      </span>
      <span>Card</span>
      <span>
        <span className="font-strong">{cardAmountWords(card - fee, fee)}</span>
        {count ? `, ${count.n} at ${money(count.cardEach)}` : ""}
      </span>
    </span>
  );
}

function MonthCard({ data, bill, today }: { data: Readonly<AppData>; bill: MonthBill; today: DateOnly }) {
  const name = monthName(bill.month, today);
  const id = `bill-${bill.month}`;
  const card = bill.pays?.method === "card";
  // Drafted on a later 1st only when the bill went out after the 19th (a family joining then).
  const moved = bill.draftDate !== bill.month;
  const drafts = bill.pays?.drafts ?? [];
  const how = card ? "by card" : "by bank draft";
  return (
    <article className="flex flex-col gap-4 overflow-hidden rounded-card bg-surface pb-5 shadow-card" aria-labelledby={id} data-testid="month-bill">
      <LaneLine />
      <div className="flex flex-col gap-3 px-5">
        <h2 id={id} className="font-heading text-big text-heading">
          {name}
        </h2>
        <div className="flex flex-col gap-1">
          <h3 className="font-strong text-heading">Total for {name}</h3>
          <Amounts bank={bill.bankCents} card={bill.cardCents} fee={bill.lines.reduce((s, l) => s + l.cardFeeEach * l.billed.length, 0)} testId="month-total" />
        </div>
        {drafts.length > 0 ? (
          <p className="rounded-control bg-success px-3 py-2" data-testid="you-pay">
            {drafts.length === 1
              ? `You pay ${money(drafts[0].cents)} ${how}, ${card ? "charged" : "drafted"} on ${longDate(drafts[0].draftDate, today)}.`
              : `You pay ${drafts.map((d, i) => `${money(d.cents)}${i === 0 ? ` ${how}` : ""} on ${longDate(d.draftDate, today)}`).join(", and ")}.`}
          </p>
        ) : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4">
          <dt className="font-strong">Bill date</dt>
          <dd data-testid="bill-date">{longDate(bill.billDate, today)}</dd>
          <dt className="font-strong">{card ? "Charge date" : "Draft date"}</dt>
          <dd data-testid="draft-date">{longDate(bill.draftDate, today)}</dd>
        </dl>
        {moved ? (
          <p data-testid="draft-moved">
            This bill reached you after the 19th, so it&apos;s {card ? "charged" : "drafted"} on the next 1st at least 10 days later.
          </p>
        ) : null}
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
              {line.draftDate !== bill.draftDate ? (
                <p data-testid="line-later">
                  Added {longDate(line.billDate, today)}, so this class is {card ? "charged" : "drafted"} on {longDate(line.draftDate, today)}.
                </p>
              ) : null}
              {line.billed.length > 0 ? (
                <Amounts bank={line.bankCents} card={line.cardCents} fee={fee} count={{ n: line.billed.length, bankEach: line.bankEach, cardEach: line.cardEach }} testId="line-prices" />
              ) : (
                <PriceRows bankCents={line.bankEach} testId="line-prices" />
              )}
            </li>
          );
        })}
      </ul>
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
          {bills.map((bill) => (
            <MonthCard key={bill.month} data={data} bill={bill} today={today} />
          ))}
          <div className="flex items-start gap-3">
            <Tag>SAMPLE</Tag>
            <p>Sample bills, worked out from your lesson dates. Nothing is ever charged in the sample.</p>
          </div>
        </>
      )}
    </ScreenShell>
  );
}
