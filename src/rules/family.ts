/*
  What a parent screen shows, worked out from stored data. Pure functions:
  "today" comes in as an argument.
*/
import { cardPricing, type CardPricing } from "@/config";
import type { AppData, Child, DateOnly, Enrollment, Family, PaymentMethod, Pool } from "@/data/types";
import { cancellationOn, cancelledDates, closedDates, closureOn } from "@/rules/closures";
import { addDays, ageInMonths } from "@/rules/dates";
import { cardPriceCents, money } from "@/rules/prices";
import { DEVICE_ID } from "@/rules/booking";

export function deviceState(data: Readonly<AppData>) {
  return data.deviceStates.find((d) => d.id === DEVICE_ID) ?? null;
}

export function currentFamily(data: Readonly<AppData>): Family | null {
  const id = deviceState(data)?.currentFamilyId;
  return (id && data.families.find((f) => f.id === id)) || null;
}

export function familyChildren(data: Readonly<AppData>, familyId: string): Child[] {
  return data.children.filter((c) => c.familyId === familyId);
}

export interface LessonInfo {
  enrollment: Enrollment;
  child: Child;
  pool: Pool;
  weekday: number;
  startTime: string;
  firstLessonDate: DateOnly;
  instructorFirstName: string;
  lessonKind: "private" | "semi-private" | "evaluation";
  parentInWater: boolean;
  /** null for the free evaluation, which is never charged. */
  bankCents: number | null;
  cardCents: number | null;
  ageMonthsOnFirst: number;
}

export function lessonInfo(data: Readonly<AppData>, enrollment: Enrollment, mode: CardPricing = cardPricing): LessonInfo | null {
  const child = data.children.find((c) => c.id === enrollment.childRecordId);
  const pool = data.pools.find((p) => p.id === enrollment.poolId);
  const time =
    enrollment.kind === "class"
      ? data.classes.find((c) => c.id === enrollment.timeId)
      : data.evaluationTimes.find((e) => e.id === enrollment.timeId);
  if (!child || !pool || !time) return null;
  const lt = enrollment.lessonTypeId ? data.lessonTypes.find((l) => l.id === enrollment.lessonTypeId) : undefined;
  const age = ageInMonths(child.birthDate, enrollment.firstLessonDate);
  return {
    enrollment,
    child,
    pool,
    weekday: time.weekday,
    startTime: time.startTime,
    firstLessonDate: enrollment.firstLessonDate,
    instructorFirstName: time.instructorFirstName,
    lessonKind: enrollment.kind === "evaluation" ? "evaluation" : (lt?.kind ?? "private"),
    parentInWater: enrollment.kind === "class" ? ("parentInWater" in time && Boolean(time.parentInWater)) : age < 36,
    bankCents: lt ? lt.bankDraftCents : null,
    cardCents: lt ? cardPriceCents(lt.bankDraftCents, mode) : null,
    ageMonthsOnFirst: age,
  };
}

/** A class or evaluation still going: not ended by a switch or a family leaving. */
export function isActive(e: Pick<Enrollment, "endedOn">): boolean {
  return !e.endedOn;
}

/** Each child's lessons, soonest first. Bills also read classes that have ended (`includeEnded`). */
export function familyLessons(data: Readonly<AppData>, familyId: string, opts: { includeEnded?: boolean } = {}): LessonInfo[] {
  return data.enrollments
    .filter((e) => e.familyId === familyId && (opts.includeEnded || isActive(e)))
    .map((e) => lessonInfo(data, e))
    .filter((x): x is LessonInfo => Boolean(x))
    .sort((a, b) => (a.firstLessonDate === b.firstLessonDate ? (a.startTime < b.startTime ? -1 : 1) : a.firstLessonDate < b.firstLessonDate ? -1 : 1));
}

export function familyPayment(data: Readonly<AppData>, familyId: string): { main: PaymentMethod | null; backup: PaymentMethod | null } {
  const methods = data.paymentMethods.filter((p) => p.familyId === familyId);
  return { main: methods.find((m) => m.job === "main") ?? null, backup: methods.find((m) => m.job === "backup") ?? null };
}

/**
 * How the family pays for lessons: a bank draft, or a card chosen for a
 * class. A card that only holds a free evaluation's spot isn't one; that
 * family sets up how it pays with a person before adding a class.
 */
export function hasLessonPayment(data: Readonly<AppData>, familyId: string): boolean {
  const { main } = familyPayment(data, familyId);
  if (!main) return false;
  return main.kind === "bank" || data.enrollments.some((e) => e.familyId === familyId && e.kind === "class" && isActive(e));
}

/** "Bank draft, with a backup card", "Card", or "Not linked yet". */
export function howTheyPay(data: Readonly<AppData>, familyId: string): string {
  const { main, backup } = familyPayment(data, familyId);
  if (!main) return "Not linked yet";
  if (main.kind === "bank") return backup ? "Bank draft, with a backup card" : "Bank draft";
  const onlyEvaluations = data.enrollments.filter((e) => e.familyId === familyId && isActive(e)).every((e) => e.kind === "evaluation");
  return onlyEvaluations ? "A card holds the spot. The free evaluation is never charged." : "Card";
}

/** The price this family pays for a lesson: the price for how they pay. */
export function priceTheyPay(info: LessonInfo, main: PaymentMethod | null): string | null {
  if (info.bankCents === null) return null;
  if (main?.kind === "card") return `${money(info.cardCents ?? info.bankCents)} a lesson by card`;
  return `${money(info.bankCents)} a lesson by bank draft`;
}

/** Lesson type words families see: "Private, you're in the water too", "Semi-private", "Free evaluation". */
export function lessonKindWords(info: Pick<LessonInfo, "lessonKind" | "parentInWater">): string {
  if (info.lessonKind === "evaluation") return info.parentInWater ? "Free evaluation, you're in the water too" : "Free evaluation";
  if (info.lessonKind === "private") return info.parentInWater ? "Private, you're in the water too" : "Private";
  return "Semi-private";
}

/**
 * A semi-private enrollment shows "No partner yet" only while it's marked
 * unpaired and the class holds no one else. Reading this never edits the
 * enrollment: staff confirm partners.
 */
export function stillUnpaired(data: Readonly<AppData>, enrollment: Enrollment): boolean {
  if (!enrollment.unpairedSince || enrollment.kind !== "class") return false;
  const cls = data.classes.find((c) => c.id === enrollment.timeId);
  return Boolean(cls && cls.capacity - cls.openSpots <= 1);
}

/** Families listed on this phone that a parent role can switch between (newest first). */
export function familiesOnThisPhone(data: Readonly<AppData>): Family[] {
  return data.families.filter((f) => f.source === "sign-up").sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function movingFamily(data: Readonly<AppData>): Family | null {
  return data.families.find((f) => f.source === "moving-over") ?? null;
}

/**
 * The lesson to show next: the first lesson until it has happened, then the
 * next week's (a family moving over sees its next lesson). Weekly classes
 * only; a free evaluation is one visit.
 */
export function upcomingLessonDate(data: Readonly<AppData>, info: LessonInfo, today: DateOnly, opts: { skipMissed?: boolean } = {}): DateOnly {
  if (info.lessonKind === "evaluation") return info.firstLessonDate;
  const held = new Set(data.attendanceMarks.filter((m) => m.childRecordId === info.child.id).map((m) => m.lessonDate));
  const skipped = [...closedDates(data, info.pool.id), ...cancelledDates(data, info.enrollment.timeId)];
  // A lesson the family told us they'll miss isn't the next one they'll come to.
  const missed = opts.skipMissed ? new Set(data.familyNotes.filter((n) => n.kind === "miss" && n.enrollmentId === info.enrollment.id).map((n) => n.lessonDate)) : new Set<string | null>();
  let d = info.firstLessonDate;
  while (d < today || held.has(d) || skipped.includes(d) || missed.has(d)) d = addDays(d, 7);
  return d;
}

export interface LessonDay {
  date: DateOnly;
  /** Set when the pool is closed that day: no lesson, and it isn't billed. */
  closedReason: string | null;
  /** Set when the school cancelled this class that day: no lesson, and it's owed. */
  cancelledReason: string | null;
}

/** The weeks ahead for one weekly class, closed days included and marked. A free evaluation is one visit. */
export function lessonDaysAhead(data: Readonly<AppData>, info: LessonInfo, today: DateOnly, weeks: number): LessonDay[] {
  if (info.lessonKind === "evaluation") {
    return info.firstLessonDate >= today ? [{ date: info.firstLessonDate, closedReason: null, cancelledReason: null }] : [];
  }
  const held = new Set(data.attendanceMarks.filter((m) => m.childRecordId === info.child.id).map((m) => m.lessonDate));
  let d = info.firstLessonDate;
  while (d < today || held.has(d)) d = addDays(d, 7);
  const days: LessonDay[] = [];
  for (let i = 0; i < weeks; i++, d = addDays(d, 7)) {
    days.push({
      date: d,
      closedReason: closureOn(data, info.pool.id, d)?.reason ?? null,
      cancelledReason: cancellationOn(data, info.enrollment.timeId, d)?.reason ?? null,
    });
  }
  return days;
}

/** One lesson to come: a weekly class's next date, a date booked in place of a lesson the school cancelled, or a fill-in. */
export interface NextLesson extends LessonInfo {
  date: DateOnly;
  /** For a date booked in place of a cancelled lesson, or a fill-in: the lesson it stands in for. */
  inPlaceOf: DateOnly | null;
  /** A fill-in for a lesson the family missed (not one the school cancelled). */
  fillIn: boolean;
}

/**
 * Dates booked in place of a lesson the school cancelled, still to come, as
 * lessons in their own slot: its time, coach and pool. The price is the
 * cancelled class's, already on the bill.
 */
export function replacementLessons(data: Readonly<AppData>, familyId: string, today: DateOnly): NextLesson[] {
  const out: NextLesson[] = [];
  const booked = [
    ...data.owedLessons.filter((o) => o.familyId === familyId).flatMap((o) => o.offers.map((offer) => ({ enrollmentId: o.enrollmentId, offer, inPlaceOf: o.cancelledDate, fillIn: false }))),
    ...data.fillIns.filter((f) => f.familyId === familyId).map((f) => ({ enrollmentId: f.enrollmentId, offer: f.offer, inPlaceOf: f.missedDate, fillIn: true })),
  ];
  for (const { enrollmentId, offer, inPlaceOf, fillIn } of booked) {
    if (offer.answer !== "yes" || offer.date < today) continue;
    const enrollment = data.enrollments.find((e) => e.id === enrollmentId);
    const info = enrollment ? lessonInfo(data, enrollment) : null;
    const time = offer.timeKind === "class" ? data.classes.find((c) => c.id === offer.timeId) : data.evaluationTimes.find((e) => e.id === offer.timeId);
    const pool = time ? data.pools.find((p) => p.id === time.poolId) : undefined;
    if (!info || !time || !pool) continue;
    out.push({
      ...info,
      pool,
      weekday: time.weekday,
      startTime: time.startTime,
      instructorFirstName: time.instructorFirstName,
      // Under 3 is always a private lesson with a parent in the water.
      parentInWater: ageInMonths(info.child.birthDate, offer.date) < 36,
      date: offer.date,
      inPlaceOf,
      fillIn,
    });
  }
  return out;
}

/** Soonest first, and by time on the same day. */
function bySoonest(a: NextLesson, b: NextLesson): number {
  return a.date === b.date ? (a.startTime < b.startTime ? -1 : 1) : a.date < b.date ? -1 : 1;
}

/** Every lesson to come for the family, one per weekly class (past any date they said they'll miss) plus any replacement dates and fill-ins, soonest first. */
export function upcomingLessons(data: Readonly<AppData>, familyId: string, today: DateOnly): NextLesson[] {
  return [
    ...familyLessons(data, familyId).map((l) => ({ ...l, date: upcomingLessonDate(data, l, today, { skipMissed: true }), inPlaceOf: null, fillIn: false })),
    ...replacementLessons(data, familyId, today),
  ].sort(bySoonest);
}

/** Each child's next lesson across all their classes and replacement dates (the soonest), soonest first. */
export function nextLessonPerChild(data: Readonly<AppData>, familyId: string, today: DateOnly): NextLesson[] {
  const byChild = new Map<string, NextLesson>();
  for (const l of upcomingLessons(data, familyId, today)) if (!byChild.has(l.child.id)) byChild.set(l.child.id, l);
  return [...byChild.values()].sort(bySoonest);
}

/** Pools where one of the family's classes hasn't had its first lesson yet: a first visit to come. */
export function poolsWithFirstVisitAhead(data: Readonly<AppData>, familyId: string): Pool[] {
  const pools = familyLessons(data, familyId)
    .filter((l) => !data.attendanceMarks.some((m) => m.enrollmentId === l.enrollment.id))
    .map((l) => l.pool);
  return [...new Map(pools.map((p) => [p.id, p])).values()];
}

/** Each child's soonest lesson. */
export function lessonPerChild(data: Readonly<AppData>, familyId: string): LessonInfo[] {
  const seen = new Set<string>();
  return familyLessons(data, familyId).filter((l) => (seen.has(l.child.id) ? false : (seen.add(l.child.id), true)));
}
