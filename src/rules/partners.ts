/*
  No partner after the first month (owner ruling 6, October 31, 2026,
  building the later-room rule): "An unpaired semi-private child pays the
  semi-private price for the first month from the first lesson. If there's
  still no partner, the family hears at least three weeks before the price
  changes. The month starts again when a partner leaves." Sign-up told the
  family: "If we haven't found a partner by then, we'll talk with you before
  anything changes."

  So once a class's first month with no partner has passed, the inbox drafts
  a note and a person sends it. The note opens that talk and says nothing
  about the class or its price changes for at least three weeks. The app
  never pairs partners, never changes a price, and never names a new one.
*/
import type { Transaction } from "@/data/store";
import type { AppData, Child, DateOnly, Enrollment, Family, IsoTime, PartnerNotice, Pool, SwimClass } from "@/data/types";
import { cancellationOn, closureOn } from "@/rules/closures";
import { addDays, addMonths, clockTime, longDate, weekdayName, weekdayOf } from "@/rules/dates";
import { familyLessons, stillUnpaired, type LessonInfo } from "@/rules/family";
import { BY_THE_SCHOOL, OfferProblemError } from "@/rules/offers";
import { NO_PARTNER_YET } from "@/content/sign-up";

/** The family hears at least three weeks before anything changes. */
export const NOTICE_DAYS = 21;

/** The first month with no partner runs a calendar month from the day the class became unpaired; this is the day after it. */
export function firstMonthEnds(since: DateOnly): DateOnly {
  return addMonths(since, 1);
}

/** The note sent for this enrollment's current stretch with no partner, if any. */
export function partnerNoticeFor(data: Readonly<AppData>, enrollment: Pick<Enrollment, "id" | "unpairedSince">): PartnerNotice | undefined {
  return data.partnerNotices.find((n) => n.enrollmentId === enrollment.id && n.unpairedSince === enrollment.unpairedSince);
}

/** The class's first lesson at least three weeks from today, past closed or cancelled days: nothing changes before it. */
export function nothingChangesBefore(data: Readonly<AppData>, cls: Pick<SwimClass, "id" | "poolId" | "weekday">, today: DateOnly): DateOnly {
  const earliest = addDays(today, NOTICE_DAYS);
  let d = addDays(earliest, (cls.weekday - weekdayOf(earliest) + 7) % 7);
  while (closureOn(data, cls.poolId, d) || cancellationOn(data, cls.id, d)) d = addDays(d, 7);
  return d;
}

export interface UnpairedItem {
  info: LessonInfo;
  family: Family;
  child: Child;
  cls: SwimClass;
  pool: Pool;
  since: DateOnly;
  /** The first month's last day. */
  monthEnded: DateOnly;
  before: DateOnly;
}

/** Semi-private classes whose first month has passed with no partner and no note yet: a person sends one. Longest first. */
export function unpairedItems(data: Readonly<AppData>, today: DateOnly): UnpairedItem[] {
  const out: UnpairedItem[] = [];
  for (const family of data.families) {
    for (const info of familyLessons(data, family.id)) {
      const since = info.enrollment.unpairedSince;
      if (info.lessonKind !== "semi-private" || !since || !stillUnpaired(data, info.enrollment)) continue;
      if (today < firstMonthEnds(since) || partnerNoticeFor(data, info.enrollment)) continue;
      const cls = data.classes.find((c) => c.id === info.enrollment.timeId);
      if (!cls) continue;
      out.push({ info, family, child: info.child, cls, pool: info.pool, since, monthEnded: addDays(firstMonthEnds(since), -1), before: nothingChangesBefore(data, cls, today) });
    }
  }
  return out.sort((a, b) => (a.since < b.since ? -1 : a.since > b.since ? 1 : 0));
}

/**
 * The words a person reviews before sending. Exactly these are stored and
 * shown to the family, one line each: where things stand, that nothing
 * changes for at least three weeks, and an invitation to talk.
 */
export function partnerNoticeWords(input: { childFirstName: string; cls: Pick<SwimClass, "weekday" | "startTime">; pool: Pick<Pool, "name" | "schoolEmail">; before: DateOnly; today: DateOnly }): string {
  const { childFirstName: name, cls, pool, before, today } = input;
  return [
    `We haven't found a partner for ${name}'s ${weekdayName(cls.weekday)} ${clockTime(cls.startTime)} class at ${pool.name} yet.`,
    `Your price for ${name}'s class stays the same until at least ${longDate(before, today)}.`,
    `We'd like to talk about what comes next. Email us at ${pool.schoolEmail}.`,
  ].join("\n");
}

/** Where a class with no partner stands for the family: its first month, past it with no note yet, or after the note. null with a partner. */
export type UnpairedStage = { kind: "first-month"; lastDay: DateOnly } | { kind: "past-month" } | { kind: "noted"; notice: PartnerNotice };

export function unpairedStage(data: Readonly<AppData>, enrollment: Enrollment, today: DateOnly): UnpairedStage | null {
  if (!enrollment.unpairedSince || !stillUnpaired(data, enrollment)) return null;
  const notice = partnerNoticeFor(data, enrollment);
  if (notice) return { kind: "noted", notice };
  const ends = firstMonthEnds(enrollment.unpairedSince);
  return today < ends ? { kind: "first-month", lastDay: addDays(ends, -1) } : { kind: "past-month" };
}

/** A person sends the note. Nothing else changes: not the class, not the price. */
export function sendPartnerNotice(tx: Transaction, input: { enrollmentId: string; today: DateOnly; now: IsoTime; newId: () => string; by?: string }): PartnerNotice {
  const item = unpairedItems(tx.data(), input.today).find((i) => i.info.enrollment.id === input.enrollmentId);
  if (!item) throw new OfferProblemError("This class isn't waiting for a note anymore.");
  return tx.add("partnerNotices", {
    id: input.newId(),
    familyId: item.family.id,
    childRecordId: item.child.id,
    enrollmentId: item.info.enrollment.id,
    unpairedSince: item.since,
    words: partnerNoticeWords({ childFirstName: item.child.firstName, cls: item.cls, pool: item.pool, before: item.before, today: input.today }),
    nothingChangesBefore: item.before,
    sentAt: input.now,
    sentBy: input.by ?? BY_THE_SCHOOL,
  });
}

/** A family's notes about a class with no partner, newest first. */
export function partnerNoticesForFamily(data: Readonly<AppData>, familyId: string): PartnerNotice[] {
  return data.partnerNotices.filter((n) => n.familyId === familyId).sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
}

/**
 * Where a sent note stands now: the class has ended, a partner has joined,
 * a partner joined and left (so the first month started again), or still no
 * partner.
 */
export function partnerNoticeNow(data: Readonly<AppData>, notice: PartnerNotice): { kind: "ended" } | { kind: "partner" } | { kind: "restarted"; since: DateOnly } | { kind: "unpaired" } {
  const enrollment = data.enrollments.find((e) => e.id === notice.enrollmentId);
  if (!enrollment || enrollment.endedOn) return { kind: "ended" };
  if (!stillUnpaired(data, enrollment)) return { kind: "partner" };
  return enrollment.unpairedSince === notice.unpairedSince ? { kind: "unpaired" } : { kind: "restarted", since: enrollment.unpairedSince! };
}

/** The line a family sees about a class with no partner, on Home and when moving over; null once it has a partner. */
export function noPartnerLine(data: Readonly<AppData>, enrollment: Enrollment, today: DateOnly): string | null {
  const stage = unpairedStage(data, enrollment, today);
  if (stage?.kind === "first-month") return `${NO_PARTNER_YET} The first month ends ${longDate(stage.lastDay, today)}.`;
  if (stage?.kind === "past-month") return "No partner yet. We'll talk with you before anything changes.";
  if (stage?.kind === "noted") return `Still no partner. Your price for this class stays the same until at least ${longDate(stage.notice.nothingChangesBefore, today)}.`;
  return null;
}
