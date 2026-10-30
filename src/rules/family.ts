/*
  What a parent screen shows, worked out from stored data. Pure functions:
  "today" comes in as an argument.
*/
import { cardPricing, type CardPricing } from "@/config";
import type { AppData, Child, DateOnly, Enrollment, Family, PaymentMethod, Pool } from "@/data/types";
import { closedDates, closureOn } from "@/rules/closures";
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

/** Each child's lessons, soonest first. */
export function familyLessons(data: Readonly<AppData>, familyId: string): LessonInfo[] {
  return data.enrollments
    .filter((e) => e.familyId === familyId)
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
  return main.kind === "bank" || data.enrollments.some((e) => e.familyId === familyId && e.kind === "class");
}

/** "Bank draft, with a backup card", "Card", or "Not linked yet". */
export function howTheyPay(data: Readonly<AppData>, familyId: string): string {
  const { main, backup } = familyPayment(data, familyId);
  if (!main) return "Not linked yet";
  if (main.kind === "bank") return backup ? "Bank draft, with a backup card" : "Bank draft";
  const onlyEvaluations = data.enrollments.filter((e) => e.familyId === familyId).every((e) => e.kind === "evaluation");
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
export function upcomingLessonDate(data: Readonly<AppData>, info: LessonInfo, today: DateOnly): DateOnly {
  if (info.lessonKind === "evaluation") return info.firstLessonDate;
  const held = new Set(data.attendanceMarks.filter((m) => m.childRecordId === info.child.id).map((m) => m.lessonDate));
  const closed = closedDates(data, info.pool.id);
  let d = info.firstLessonDate;
  while (d < today || held.has(d) || closed.includes(d)) d = addDays(d, 7);
  return d;
}

export interface LessonDay {
  date: DateOnly;
  /** Set when the pool is closed that day: no lesson, and it isn't billed. */
  closedReason: string | null;
}

/** The weeks ahead for one weekly class, closed days included and marked. A free evaluation is one visit. */
export function lessonDaysAhead(data: Readonly<AppData>, info: LessonInfo, today: DateOnly, weeks: number): LessonDay[] {
  if (info.lessonKind === "evaluation") {
    return info.firstLessonDate >= today ? [{ date: info.firstLessonDate, closedReason: null }] : [];
  }
  const held = new Set(data.attendanceMarks.filter((m) => m.childRecordId === info.child.id).map((m) => m.lessonDate));
  let d = info.firstLessonDate;
  while (d < today || held.has(d)) d = addDays(d, 7);
  const days: LessonDay[] = [];
  for (let i = 0; i < weeks; i++, d = addDays(d, 7)) days.push({ date: d, closedReason: closureOn(data, info.pool.id, d)?.reason ?? null });
  return days;
}

/** Each child's next lesson across all their classes (the soonest upcoming date), soonest first. */
export function nextLessonPerChild(data: Readonly<AppData>, familyId: string, today: DateOnly): (LessonInfo & { date: DateOnly })[] {
  const byChild = new Map<string, LessonInfo & { date: DateOnly }>();
  for (const l of familyLessons(data, familyId)) {
    const date = upcomingLessonDate(data, l, today);
    const current = byChild.get(l.child.id);
    if (!current || date < current.date || (date === current.date && l.startTime < current.startTime)) byChild.set(l.child.id, { ...l, date });
  }
  return [...byChild.values()].sort((a, b) => (a.date === b.date ? (a.startTime < b.startTime ? -1 : 1) : a.date < b.date ? -1 : 1));
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
