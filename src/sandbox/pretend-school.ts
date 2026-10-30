/*
  Sandbox only. Two things a person at the school would do, so the inbox
  has something to show: a family leaves a full class someone on this
  phone is waiting for, and the school cancels a family's next lesson.
  Neither offers anything to anyone; that stays with a person in the inbox.
*/
import type { Transaction } from "@/data/store";
import type { DateOnly, IsoTime } from "@/data/types";
import { upcomingLessons } from "@/rules/family";
import { leaveClass } from "@/rules/offers";
import { cancelClassDate } from "@/rules/owed";
import { timesForChild } from "@/rules/times";

/**
 * For each full class a family on this phone waits for, one sample family
 * leaves: the class they named, or, waiting for any time that fits at a
 * pool, each full class there that fits the child. Returns the classes with
 * a spot open now.
 */
export function pretendFamilyLeft(tx: Transaction, input: { today: DateOnly }): string[] {
  const freed: string[] = [];
  const sample = new Set(tx.list("families").filter((f) => f.source === "sample").map((f) => f.id));
  const data = tx.data();
  const wanted = new Set<string>();
  for (const w of tx.list("waitlistEntries")) {
    if (w.classId) {
      wanted.add(w.classId);
      continue;
    }
    const child = data.children.find((c) => c.id === w.childRecordId);
    if (!child) continue;
    for (const o of timesForChild({ data, poolId: w.poolId, birthDate: child.birthDate, stage: child.stageId ?? "evaluation", today: input.today }).classes) if (o.full) wanted.add(o.id);
  }
  for (const classId of wanted) {
    const cls = tx.get("classes", classId);
    if (!cls || cls.openSpots > 0) continue;
    const leaving = tx.list("enrollments").find((e) => e.kind === "class" && e.timeId === cls.id && !e.endedOn && sample.has(e.familyId));
    if (!leaving) continue;
    leaveClass(tx, leaving.id, input.today);
    freed.push(cls.id);
  }
  return freed;
}

/** The school cancels the family's soonest class lesson. Each child in that class is owed the lesson. */
export function pretendSchoolCancelled(
  tx: Transaction,
  input: { familyId: string; today: DateOnly; now: IsoTime; newId: () => string },
): { childFirstName: string; date: DateOnly } | null {
  // A weekly class's lesson; a date booked in place of a cancelled one isn't a class date to cancel.
  const next = upcomingLessons(tx.data(), input.familyId, input.today).find((l) => l.lessonKind !== "evaluation" && !l.inPlaceOf);
  if (!next) return null;
  const owed = cancelClassDate(tx, {
    classId: next.enrollment.timeId,
    date: next.date,
    reason: `Coach ${next.instructorFirstName} is away that day (sample)`,
    now: input.now,
    newId: input.newId,
  });
  return owed.length > 0 ? { childFirstName: next.child.firstName, date: next.date } : null;
}
