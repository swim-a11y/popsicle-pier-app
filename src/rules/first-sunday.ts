/*
  The first Sunday: who stayed on deck, and which notes a family may see.
  A lesson can't be marked held without an adult who may stay: the parent,
  or a listed adult only once Signed.
*/
import type { Transaction } from "@/data/store";
import type { AppData, AttendanceMark, IsoTime, LessonNote, ListedAdult, OnDeckAdult } from "@/data/types";

export class AdultCantStayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdultCantStayError";
  }
}

/** The parent always may; a listed adult only once Signed, never while Waiting. */
export function canStayOnDeck(adult: OnDeckAdult | null | undefined, listed?: Pick<ListedAdult, "status"> | null): boolean {
  if (!adult) return false;
  if (adult.kind === "parent") return Boolean(adult.name);
  return listed?.status === "signed";
}

export function markLessonHeld(
  tx: Transaction,
  input: { enrollmentId: string; adult: OnDeckAdult | null; now: IsoTime; id: string; lessonDate?: string },
): AttendanceMark {
  const enrollment = tx.get("enrollments", input.enrollmentId);
  if (!enrollment) throw new Error("No such enrollment.");
  const lessonDate = input.lessonDate ?? enrollment.firstLessonDate;
  const listed = input.adult?.kind === "listed-adult" ? tx.get("listedAdults", input.adult.listedAdultId) : null;
  if (input.adult?.kind === "listed-adult" && (!listed || listed.familyId !== enrollment.familyId)) {
    throw new AdultCantStayError("That adult isn't listed for this family.");
  }
  if (!canStayOnDeck(input.adult, listed)) {
    throw new AdultCantStayError(
      input.adult ? "A listed adult who is still Waiting can't be the adult on deck." : "A lesson can't be marked held without an adult on deck.",
    );
  }
  const existing = tx
    .list("attendanceMarks")
    .find((m) => m.childRecordId === enrollment.childRecordId && m.lessonDate === lessonDate);
  if (existing) return existing;
  const time = enrollment.kind === "class" ? tx.get("classes", enrollment.timeId) : tx.get("evaluationTimes", enrollment.timeId);
  if (!time) throw new Error("No such time.");
  return tx.add("attendanceMarks", {
    id: input.id,
    familyId: enrollment.familyId,
    childRecordId: enrollment.childRecordId,
    enrollmentId: enrollment.id,
    poolId: enrollment.poolId,
    lessonDate,
    slot: time.startTime,
    instructorFirstName: time.instructorFirstName,
    adult: input.adult!,
    held: true,
    markedAt: input.now,
  });
}

/** Only approved notes ever reach a parent screen, and only for the family's own children. Newest first. */
export function approvedNotesForFamily(data: Readonly<AppData>, familyId: string): LessonNote[] {
  const own = new Set(data.children.filter((c) => c.familyId === familyId).map((c) => c.id));
  return data.lessonNotes
    .filter((n) => n.status === "approved" && n.familyId === familyId && own.has(n.childRecordId))
    .sort((a, b) => (a.lessonDate === b.lessonDate ? (a.createdAt < b.createdAt ? 1 : -1) : a.lessonDate < b.lessonDate ? 1 : -1));
}

/** "After the first lesson" means an attendance mark exists, not that the date has passed. */
export function hasHadFirstLesson(data: Readonly<AppData>, childRecordId: string): boolean {
  return data.attendanceMarks.some((m) => m.childRecordId === childRecordId && m.held);
}

/** "On deck: you", "On deck: Rose", or for an under-3 "In the water with Mia: you". */
export function onDeckLine(mark: AttendanceMark | undefined, childFirstName: string, parentInWater: boolean): string {
  if (parentInWater) return `In the water with ${childFirstName}: you`;
  if (!mark || mark.adult.kind === "parent") return "On deck: you";
  return `On deck: ${mark.adult.firstName}`;
}
