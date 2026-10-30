/*
  "Pretend the first lesson happened" (sandbox only). For each child of the
  current family: an attendance mark naming the parent on deck, then an
  approved note from a coach-line template for the child's stage, dated on
  that child's first lesson: the one Home and Your first lesson show (past a
  day the family said they'll miss, or a cancelled lesson's replacement if
  that comes first). A child with a custody or health yes is held until a
  person records the talk in the inbox. A second press adds nothing new.
*/
import type { Transaction } from "@/data/store";
import type { IsoTime } from "@/data/types";
import { sha256Hex } from "@/lib/sha256";
import { todayAtSchool } from "@/rules/dates";
import { nextLessonPerChild } from "@/rules/family";
import { markLessonHeld } from "@/rules/first-sunday";

export function pretendFirstLesson(tx: Transaction, input: { familyId: string; now: IsoTime; newId: () => string }): { added: number; held: string[] } {
  const family = tx.get("families", input.familyId);
  if (!family) return { added: 0, held: [] };
  let added = 0;
  const held: string[] = [];
  // The first lesson is the one Home and Your first lesson show: past any day the family said they'll miss,
  // a cancelled one's replacement if that comes first, in its own slot.
  const next = nextLessonPerChild(tx.data(), family.id, todayAtSchool(new Date(input.now)));
  for (const child of tx.list("children").filter((c) => c.familyId === family.id)) {
    // Only the first lesson: once any lesson is marked, a second press adds nothing.
    if (tx.list("attendanceMarks").some((m) => m.childRecordId === child.id)) continue;
    const lesson = next.find((l) => l.child.id === child.id);
    if (!lesson) continue;
    // A custody or health yes holds the first lesson until a person has talked with the family (the inbox records it).
    if (child.flaggedForPerson) {
      held.push(child.firstName);
      continue;
    }
    const enrollment = lesson.enrollment;
    const mark = markLessonHeld(tx, {
      enrollmentId: enrollment.id,
      adult: { kind: "parent", name: family.parentFullName },
      now: input.now,
      id: input.newId(),
      lessonDate: lesson.date,
      slot: { startTime: lesson.startTime, instructorFirstName: lesson.instructorFirstName, poolId: lesson.pool.id },
    });
    const stage = enrollment.kind === "evaluation" ? "evaluation" : (child.stageId ?? "evaluation");
    const templates = tx.list("coachLineTemplates").filter((t) => t.stageId === stage);
    if (templates.length === 0) continue;
    const template = templates[parseInt(sha256Hex(child.id).slice(0, 8), 16) % templates.length];
    tx.add("lessonNotes", {
      id: input.newId(),
      familyId: family.id,
      childRecordId: child.id,
      attendanceMarkId: mark.id,
      poolId: mark.poolId,
      lessonDate: mark.lessonDate,
      instructorFirstName: mark.instructorFirstName,
      stageId: enrollment.kind === "evaluation" ? null : child.stageId,
      lineToday: template.today.replaceAll("[name]", child.firstName),
      lineNext: template.next.replaceAll("[name]", child.firstName),
      templateId: template.id,
      status: "approved",
      approvedBy: mark.instructorFirstName,
      approvedAt: input.now,
      createdAt: input.now,
    });
    added += 1;
  }
  return { added, held };
}
