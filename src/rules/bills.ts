/*
  Monthly bills, lessons only (the owner's ruling, October 30, 2026): each
  month's lessons times the lesson price, with the bank draft and card
  price on every line. Closed days aren't billed. A bill reaches the family
  by the 19th, at least 10 days before its draft on the 1st; a bill that
  can only go out later (a family who joins after the 19th) moves its draft
  to 10 days after, so the 10 days always hold. No fees until the owner
  sets the amounts. Bills are worked out from the lesson dates, never
  stored, in this sample, and nothing is ever charged.
*/
import { cardPricing, type CardPricing } from "@/config";
import type { AppData, DateOnly } from "@/data/types";
import { cancellationOn, closureOn } from "@/rules/closures";
import { addDays, addMonths, makeDate, parseDate, todayAtSchool, weekdayOf } from "@/rules/dates";
import { familyLessons, familyPayment, type LessonInfo } from "@/rules/family";
import { cardFeeCents, cardPriceCents } from "@/rules/prices";

export const BILL_DAY = 19;
export const MIN_NOTICE_DAYS = 10;

export interface BillLine {
  lesson: LessonInfo;
  /** The lesson dates on this bill. */
  billed: DateOnly[];
  /** Closed days: no lesson, not billed. */
  closed: { date: DateOnly; reason: string }[];
  /** Cancelled by the school: billed while a date is owed in its place; not billed once the owner approves a credit. */
  cancelled: { date: DateOnly; credited: boolean }[];
  bankEach: number;
  cardEach: number;
  /** "card fee" mode only. */
  cardFeeEach: number;
  bankCents: number;
  cardCents: number;
}

export interface MonthBill {
  /** The month's first day, "2026-11-01". */
  month: DateOnly;
  billDate: DateOnly;
  draftDate: DateOnly;
  lines: BillLine[];
  bankCents: number;
  cardCents: number;
  /** What this family pays, by how they pay. null until a way to pay is linked. */
  pays: { method: "bank" | "card"; cents: number } | null;
}

function monthOf(d: DateOnly): DateOnly {
  const p = parseDate(d);
  return makeDate(p.y, p.m, 1);
}

function maxDate(a: DateOnly, b: DateOnly): DateOnly {
  return a > b ? a : b;
}

/** A class's weekly dates in one month, from its first lesson on. */
function classDatesIn(info: LessonInfo, month: DateOnly): DateOnly[] {
  const next = addMonths(month, 1);
  let d = maxDate(info.firstLessonDate, month);
  d = addDays(d, (info.weekday - weekdayOf(d) + 7) % 7);
  const out: DateOnly[] = [];
  for (; d < next; d = addDays(d, 7)) out.push(d);
  return out;
}

/**
 * The first month billed in this app: the month of the first lesson. A
 * family moving over is billed from the first month whose bill date (the
 * 19th before it) was still ahead on the day it moved over; until then,
 * nothing.
 */
export function firstBillMonth(data: Readonly<AppData>, familyId: string): DateOnly | null {
  const family = data.families.find((f) => f.id === familyId);
  const classes = familyLessons(data, familyId).filter((l) => l.bankCents !== null);
  if (!family || classes.length === 0) return null;
  if (family.source === "moving-over") {
    if (!family.movedOverAt) return null;
    const moved = parseDate(todayAtSchool(new Date(family.movedOverAt)));
    return addMonths(makeDate(moved.y, moved.m, 1), moved.d <= BILL_DAY ? 1 : 2);
  }
  return monthOf(classes.map((l) => l.firstLessonDate).sort()[0]);
}

/** One month's bill for a family: a line per class, both prices on every line. */
export function monthBill(data: Readonly<AppData>, familyId: string, month: DateOnly, mode: CardPricing = cardPricing): MonthBill {
  const lines: BillLine[] = [];
  let joined = "";
  for (const info of familyLessons(data, familyId)) {
    if (info.bankCents === null || info.lessonKind === "evaluation") continue;
    const dates = classDatesIn(info, month);
    if (dates.length === 0) continue;
    const line: BillLine = {
      lesson: info,
      billed: [],
      closed: [],
      cancelled: [],
      bankEach: info.bankCents,
      cardEach: cardPriceCents(info.bankCents, mode),
      cardFeeEach: cardFeeCents(info.bankCents, mode),
      bankCents: 0,
      cardCents: 0,
    };
    for (const d of dates) {
      const closure = closureOn(data, info.pool.id, d);
      if (closure) {
        line.closed.push({ date: d, reason: closure.reason });
        continue;
      }
      if (cancellationOn(data, info.enrollment.timeId, d)) {
        const credited = data.owedLessons.some((o) => o.enrollmentId === info.enrollment.id && o.cancelledDate === d && o.creditApprovedAt !== null);
        line.cancelled.push({ date: d, credited });
        if (credited) continue;
      }
      line.billed.push(d);
    }
    line.bankCents = line.billed.length * line.bankEach;
    line.cardCents = line.billed.length * (line.cardEach + line.cardFeeEach);
    lines.push(line);
    const added = todayAtSchool(new Date(info.enrollment.createdAt));
    if (added > joined) joined = added;
  }
  // By the 19th before the month, or the day the newest class on it was added, if later.
  const before = parseDate(addMonths(month, -1));
  const billDate = maxDate(makeDate(before.y, before.m, BILL_DAY), joined);
  const draftDate = maxDate(month, addDays(billDate, MIN_NOTICE_DAYS));
  const bankCents = lines.reduce((s, l) => s + l.bankCents, 0);
  const cardCents = lines.reduce((s, l) => s + l.cardCents, 0);
  const { main } = familyPayment(data, familyId);
  return {
    month,
    billDate,
    draftDate,
    lines,
    bankCents,
    cardCents,
    pays: main ? { method: main.kind, cents: main.kind === "bank" ? bankCents : cardCents } : null,
  };
}

/** This month's bill and the next (from the first month billed), for the Bills screen. */
export function upcomingBills(data: Readonly<AppData>, familyId: string, today: DateOnly, count = 2, mode: CardPricing = cardPricing): MonthBill[] {
  const first = firstBillMonth(data, familyId);
  if (!first) return [];
  let month = maxDate(first, monthOf(today));
  const bills: MonthBill[] = [];
  for (let i = 0; i < count; i++, month = addMonths(month, 1)) {
    const bill = monthBill(data, familyId, month, mode);
    if (bill.lines.length > 0) bills.push(bill);
  }
  return bills;
}
