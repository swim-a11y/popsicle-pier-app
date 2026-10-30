/*
  "Pretend the first lesson happened" (sandbox only). For each child of the
  current family: an attendance mark naming the parent on deck, then an
  approved note from a coach-line template for the child's stage, dated on
  that child's first lesson date. A second press adds nothing.
*/
import type { Transaction } from "@/data/store";
import type { IsoTime } from "@/data/types";
import { sha256Hex } from "@/lib/sha256";
import { markLessonHeld } from "@/rules/first-sunday";

export function pretendFirstLesson(tx: Transaction, input: { familyId: string; now: IsoTime; newId: () => string }): { added: number } {
  const family = tx.get("families", input.familyId);
  if (!family) return { added: 0 };
  let added = 0;
  for (const child of tx.list("children").filter((c) => c.familyId === family.id)) {
    const enrollment = tx
      .list("enrollments")
      .filter((e) => e.childRecordId === child.id)
      .sort((a, b) => (a.firstLessonDate < b.firstLessonDate ? -1 : 1))[0];
    if (!enrollment) continue;
    if (tx.list("attendanceMarks").some((m) => m.childRecordId === child.id && m.lessonDate === enrollment.firstLessonDate)) continue;
    const mark = markLessonHeld(tx, {
      enrollmentId: enrollment.id,
      adult: { kind: "parent", name: family.parentFullName },
      now: input.now,
      id: input.newId(),
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
  return { added };
}
