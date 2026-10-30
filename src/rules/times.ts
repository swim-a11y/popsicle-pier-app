/*
  Which times fit a child at a pool. The family picks; this only lists.
  Nothing here pairs partners or moves anyone.
*/
import { cardPricing as defaultMode, type CardPricing } from "@/config";
import type { AppData, DateOnly, StageId } from "@/data/types";
import { addMonths, ageInMonths, compareDates, firstLessonDate, minutesOfDay } from "@/rules/dates";
import { cardPriceCents } from "@/rules/prices";

export const UNDER_3_MONTHS = 36;

export interface SiblingPick {
  name: string;
  booking: { kind: "class" | "evaluation"; timeId: string } | null;
}

export interface TimeOption {
  kind: "class" | "evaluation";
  id: string;
  poolId: string;
  weekday: number;
  startTime: string;
  firstLessonDate: DateOnly;
  instructorFirstName: string;
  lessonKind: "private" | "semi-private" | "evaluation";
  parentInWater: boolean;
  bankCents: number | null;
  cardCents: number | null;
  spotsLeft: number;
  full: boolean;
  noPartnerYet: boolean;
  sibling: { name: string; relation: "same-time" | "next-to" } | null;
}

export interface ChildTimes {
  ageMonthsOnFirst: number | null;
  under3: boolean;
  tooYoung: { canStartOn: DateOnly; youngestAgeMonths: number } | null;
  classes: TimeOption[];
  evaluations: TimeOption[];
  /** No open class fits: offer the waitlist or the free evaluation. */
  nothingFits: boolean;
}

function siblingMark(siblings: SiblingPick[], all: Map<string, { weekday: number; startTime: string; slotMinutes: number }>, weekday: number, startTime: string) {
  for (const s of siblings) {
    if (!s.booking) continue;
    const t = all.get(s.booking.timeId);
    if (!t || t.weekday !== weekday) continue;
    const diff = Math.abs(minutesOfDay(t.startTime) - minutesOfDay(startTime));
    if (diff === 0) return { name: s.name, relation: "same-time" as const };
    if (diff === t.slotMinutes) return { name: s.name, relation: "next-to" as const };
  }
  return null;
}

export function timesForChild(input: {
  data: Readonly<AppData>;
  poolId: string;
  birthDate: DateOnly;
  stage: StageId | "evaluation" | null;
  today: DateOnly;
  siblings?: SiblingPick[];
  mode?: CardPricing;
}): ChildTimes {
  const { data, poolId, birthDate, stage, today } = input;
  const siblings = input.siblings ?? [];
  const mode = input.mode ?? defaultMode;
  const pool = data.pools.find((p) => p.id === poolId);
  const empty: ChildTimes = { ageMonthsOnFirst: null, under3: false, tooYoung: null, classes: [], evaluations: [], nothingFits: true };
  if (!pool) return empty;

  const poolClasses = data.classes.filter((c) => c.poolId === poolId);
  const poolEvals = data.evaluationTimes.filter((e) => e.poolId === poolId);
  const allTimes = new Map<string, { weekday: number; startTime: string; slotMinutes: number }>();
  for (const t of [...data.classes, ...data.evaluationTimes]) allTimes.set(t.id, t);

  const firstDates = [...poolClasses, ...poolEvals].map((t) => firstLessonDate(t.weekday, today, pool.opensOn));
  const soonest = firstDates.sort(compareDates)[0] ?? firstLessonDate(0, today, pool.opensOn);
  const ageOnSoonest = ageInMonths(birthDate, soonest);
  const under3 = ageOnSoonest < UNDER_3_MONTHS;

  if (ageOnSoonest < pool.youngestAgeMonths) {
    return { ...empty, ageMonthsOnFirst: ageOnSoonest, under3, tooYoung: { canStartOn: addMonths(birthDate, pool.youngestAgeMonths), youngestAgeMonths: pool.youngestAgeMonths } };
  }

  const classes: TimeOption[] = [];
  if (stage !== "evaluation") {
    for (const c of poolClasses) {
      const first = firstLessonDate(c.weekday, today, pool.opensOn);
      const age = ageInMonths(birthDate, first);
      if (age < pool.youngestAgeMonths || age < c.minAgeMonths || age > c.maxAgeMonths) continue;
      const lt = data.lessonTypes.find((l) => l.id === c.lessonTypeId);
      if (!lt) continue;
      // Under 3 is a private lesson with a parent in the water, never a shared class.
      if (age < UNDER_3_MONTHS && !(lt.kind === "private" && c.parentInWater)) continue;
      if (lt.kind === "semi-private" && (stage === null || c.stageId !== stage)) continue;
      const picked = siblings.filter((s) => s.booking?.kind === "class" && s.booking.timeId === c.id).length;
      const spotsLeft = c.openSpots - picked;
      classes.push({
        kind: "class",
        id: c.id,
        poolId,
        weekday: c.weekday,
        startTime: c.startTime,
        firstLessonDate: first,
        instructorFirstName: c.instructorFirstName,
        lessonKind: lt.kind,
        parentInWater: c.parentInWater,
        bankCents: lt.bankDraftCents,
        cardCents: cardPriceCents(lt.bankDraftCents, mode),
        spotsLeft,
        full: spotsLeft <= 0,
        noPartnerYet: lt.kind === "semi-private" && c.openSpots === c.capacity && picked === 0,
        sibling: siblingMark(siblings, allTimes, c.weekday, c.startTime),
      });
    }
  }

  const evaluations: TimeOption[] = [];
  for (const e of poolEvals) {
    const first = firstLessonDate(e.weekday, today, pool.opensOn);
    const age = ageInMonths(birthDate, first);
    if (age < pool.youngestAgeMonths) continue;
    const picked = siblings.filter((s) => s.booking?.kind === "evaluation" && s.booking.timeId === e.id).length;
    const spotsLeft = e.openSpots - picked;
    evaluations.push({
      kind: "evaluation",
      id: e.id,
      poolId,
      weekday: e.weekday,
      startTime: e.startTime,
      firstLessonDate: first,
      instructorFirstName: e.instructorFirstName,
      lessonKind: "evaluation",
      parentInWater: age < UNDER_3_MONTHS,
      bankCents: null,
      cardCents: null,
      spotsLeft,
      full: spotsLeft <= 0,
      noPartnerYet: false,
      sibling: siblingMark(siblings, allTimes, e.weekday, e.startTime),
    });
  }

  const order = (a: TimeOption, b: TimeOption) => compareDates(a.firstLessonDate, b.firstLessonDate) || minutesOfDay(a.startTime) - minutesOfDay(b.startTime);
  classes.sort(order);
  evaluations.sort(order);
  return { ageMonthsOnFirst: ageOnSoonest, under3, tooYoung: null, classes, evaluations, nothingFits: !classes.some((c) => !c.full) };
}
