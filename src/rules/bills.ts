/*
  Monthly bills, lessons only (the owner's ruling, October 30, 2026): each
  month's lessons times the lesson price, with the bank draft and card
  price on every line. Closed days aren't billed. Every draft is on a 1st,
  and every bill reaches the family by the 19th before its draft, at least
  10 days ahead, as the bank-draft words they sign say. A bill that can only
  go out later (a family joining after the 19th, or a class added then)
  reaches them the day the class is added, before its first lesson, and is
  drafted on the next 1st at least 10 days on. No fees until the owner sets
  the amounts. Bills are worked out from the lesson dates, never stored, in
  this sample, and nothing is ever charged.
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
  /** The day this line's bill reaches the family, and the 1st it's drafted on. */
  billDate: DateOnly;
  draftDate: DateOnly;
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
  /** The month's bill: its first lines' bill date and draft. A line added later carries its own. */
  billDate: DateOnly;
  draftDate: DateOnly;
  lines: BillLine[];
  bankCents: number;
  cardCents: number;
  /** What this family pays on each draft date, by how they pay. null until a way to pay is linked. */
  pays: { method: "bank" | "card"; drafts: { draftDate: DateOnly; cents: number }[] } | null;
}

function monthOf(d: DateOnly): DateOnly {
  const p = parseDate(d);
  return makeDate(p.y, p.m, 1);
}

function maxDate(a: DateOnly, b: DateOnly): DateOnly {
  return a > b ? a : b;
}

/** A class's weekly dates in one month, from its first lesson on, and before the day it ended, if it has. */
function classDatesIn(info: LessonInfo, month: DateOnly): DateOnly[] {
  const next = addMonths(month, 1);
  const end = info.enrollment.endedOn && info.enrollment.endedOn < next ? info.enrollment.endedOn : next;
  let d = maxDate(info.firstLessonDate, month);
  d = addDays(d, (info.weekday - weekdayOf(d) + 7) % 7);
  const out: DateOnly[] = [];
  for (; d < end; d = addDays(d, 7)) out.push(d);
  return out;
}

/**
 * One class's bill for a month: it reaches the family by the 19th before the
 * month, or the day the class was added if that's later; it's drafted on the
 * first 1st at least 10 days after that.
 */
export function billDates(month: DateOnly, addedOn: DateOnly): { billDate: DateOnly; draftDate: DateOnly } {
  const before = parseDate(addMonths(month, -1));
  const billDate = maxDate(makeDate(before.y, before.m, BILL_DAY), addedOn);
  const earliest = parseDate(addDays(billDate, MIN_NOTICE_DAYS));
  const draftDate = earliest.d === 1 ? makeDate(earliest.y, earliest.m, 1) : addMonths(makeDate(earliest.y, earliest.m, 1), 1);
  return { billDate, draftDate };
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
  for (const info of familyLessons(data, familyId, { includeEnded: true })) {
    if (info.bankCents === null || info.lessonKind === "evaluation") continue;
    const dates = classDatesIn(info, month);
    if (dates.length === 0) continue;
    const line: BillLine = {
      lesson: info,
      ...billDates(month, todayAtSchool(new Date(info.enrollment.createdAt))),
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
        // A credit on this lesson, or on an owed lesson that took its place after the school cancelled the new date too.
        const credited = data.owedLessons.some((o) => o.enrollmentId === info.enrollment.id && o.billedDate === d && o.creditApprovedAt !== null);
        line.cancelled.push({ date: d, credited });
        if (credited) continue;
      }
      line.billed.push(d);
    }
    line.bankCents = line.billed.length * line.bankEach;
    line.cardCents = line.billed.length * (line.cardEach + line.cardFeeEach);
    lines.push(line);
  }
  // The month's bill date and draft are its first lines'; a class added after them is drafted on its own later 1st.
  const first = [...lines].sort((a, b) => (a.billDate < b.billDate ? -1 : a.billDate > b.billDate ? 1 : 0))[0];
  const billDate = first?.billDate ?? billDates(month, month).billDate;
  const draftDate = first?.draftDate ?? billDates(month, month).draftDate;
  const bankCents = lines.reduce((s, l) => s + l.bankCents, 0);
  const cardCents = lines.reduce((s, l) => s + l.cardCents, 0);
  const { main } = familyPayment(data, familyId);
  const drafts = [...new Set(lines.map((l) => l.draftDate))].sort().map((draftDate) => ({
    draftDate,
    cents: lines.filter((l) => l.draftDate === draftDate).reduce((s, l) => s + (main?.kind === "card" ? l.cardCents : l.bankCents), 0),
  }));
  return { month, billDate, draftDate, lines, bankCents, cardCents, pays: main ? { method: main.kind, drafts } : null };
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
