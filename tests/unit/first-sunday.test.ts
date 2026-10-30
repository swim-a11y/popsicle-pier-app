import { describe, expect, it } from "vitest";

import { LocalStore } from "@/data/store";
import { signAndSave } from "@/rules/booking";
import { AdultCantStayError, approvedNotesForFamily, canStayOnDeck, hasHadFirstLesson, markLessonHeld, onDeckLine } from "@/rules/first-sunday";
import { stageName } from "@/content/path";
import { pretendFirstLesson } from "@/sandbox/pretend-first-lesson";
import { buildSeed } from "@/sandbox/seed";

import { completeDraft, memoryStorage, NOW, testId, TODAY } from "./helpers";

async function family(draft = completeDraft({ listed: [{ firstName: "Rose", relationship: "grandparent" }] })) {
  const store = new LocalStore({ seedVersion: "t", seed: buildSeed, storage: memoryStorage() });
  await store.transaction((tx) => tx.add("signUpDrafts", draft));
  const { familyId } = await store.transaction((tx) => signAndSave(tx, { draft, today: TODAY, now: NOW, browserName: "Chrome", newId: testId }));
  return { store, familyId };
}

describe("first Sunday", () => {
  it("an attendance mark names the parent or a Signed adult, never a Waiting one", async () => {
    expect(canStayOnDeck({ kind: "parent", name: "Jordan Sample" })).toBe(true);
    const listed = { kind: "listed-adult" as const, listedAdultId: "a", firstName: "Rose", isParentOrGuardian: false };
    expect(canStayOnDeck(listed, { status: "waiting" })).toBe(false);
    expect(canStayOnDeck(listed, { status: "signed" })).toBe(true);
    expect(canStayOnDeck(null)).toBe(false);

    const { store, familyId } = await family();
    const data = await store.snapshot();
    const rose = data.listedAdults.find((a) => a.familyId === familyId)!;
    const enrollment = data.enrollments.find((e) => e.familyId === familyId)!;
    expect(rose.status).toBe("waiting");
    const roseOnDeck = { kind: "listed-adult" as const, listedAdultId: rose.id, firstName: rose.firstName, isParentOrGuardian: rose.isParentOrGuardian };
    await expect(store.transaction((tx) => markLessonHeld(tx, { enrollmentId: enrollment.id, adult: roseOnDeck, now: NOW, id: "m1" }))).rejects.toThrow(AdultCantStayError);
    await expect(store.transaction((tx) => markLessonHeld(tx, { enrollmentId: enrollment.id, adult: null, now: NOW, id: "m1" }))).rejects.toThrow(AdultCantStayError);
    expect((await store.snapshot()).attendanceMarks).toHaveLength(0);
    // Once Rose signs on paper at the desk, she may be the adult on deck.
    await store.transaction((tx) => tx.update("listedAdults", rose.id, { status: "signed", signedHow: "paper-at-desk", signedAt: NOW }));
    const mark = await store.transaction((tx) => markLessonHeld(tx, { enrollmentId: enrollment.id, adult: roseOnDeck, now: NOW, id: "m2" }));
    expect(mark.adult).toEqual(roseOnDeck);
    expect(mark.held).toBe(true);
    expect(mark.slot).toBe("10:00");
  });

  it("pretend the first lesson happened adds marks and approved notes once", async () => {
    const { store, familyId } = await family(
      completeDraft({
        kids: [
          { firstName: "Mia", birth: "2022-07-30", stage: "shallows", booking: { kind: "class", timeId: "mad-sun-1000-shallows" } },
          { firstName: "Leo", birth: "2023-05-01", stage: "pier", booking: { kind: "class", timeId: "mad-sun-0930-pier" } },
        ],
        listed: [{ firstName: "Rose", relationship: "grandparent" }],
      }),
    );
    const first = await store.transaction((tx) => pretendFirstLesson(tx, { familyId, now: NOW, newId: testId }));
    expect(first.added).toBe(2);
    const data = await store.snapshot();
    const marks = data.attendanceMarks.filter((m) => m.familyId === familyId);
    expect(marks).toHaveLength(2);
    for (const m of marks) expect(m.adult).toEqual({ kind: "parent", name: "Jordan Sample" });
    const notes = data.lessonNotes.filter((n) => n.familyId === familyId);
    expect(notes.every((n) => n.status === "approved" && n.approvedBy && n.approvedAt)).toBe(true);
    for (const n of notes) {
      const e = data.enrollments.find((x) => x.childRecordId === n.childRecordId)!;
      expect(n.lessonDate).toBe(e.firstLessonDate);
      expect(hasHadFirstLesson(data, n.childRecordId)).toBe(true);
    }
    const second = await store.transaction((tx) => pretendFirstLesson(tx, { familyId, now: NOW, newId: testId }));
    expect(second.added).toBe(0);
    expect((await store.snapshot()).lessonNotes.filter((n) => n.familyId === familyId)).toHaveLength(2);
  });

  it("only approved notes reach parent screens", async () => {
    const { store, familyId } = await family();
    await store.transaction((tx) => pretendFirstLesson(tx, { familyId, now: NOW, newId: testId }));
    const data = await store.snapshot();
    const approved = approvedNotesForFamily(data, familyId);
    expect(approved).toHaveLength(1);
    await store.transaction((tx) => {
      const note = approved[0];
      tx.add("lessonNotes", { ...note, id: "draft-note", status: "draft", approvedBy: null, approvedAt: null, lineToday: "A draft line.", lessonDate: "2026-11-15" });
      // Another family's approved note.
      tx.add("lessonNotes", { ...note, id: "other-family-note", familyId: "family-marlow", childRecordId: "child-ari" });
    });
    const after = approvedNotesForFamily(await store.snapshot(), familyId);
    expect(after.map((n) => n.id)).toEqual([approved[0].id]);
  });

  it("notes show the child's own stage name only", async () => {
    const { store, familyId } = await family();
    await store.transaction((tx) => pretendFirstLesson(tx, { familyId, now: NOW, newId: testId }));
    const data = await store.snapshot();
    const [note] = approvedNotesForFamily(data, familyId);
    const child = data.children.find((c) => c.id === note.childRecordId)!;
    expect(note.stageId).toBe(child.stageId);
    expect(stageName(note.stageId)).toBe("The Shallows");
    expect(note.lineToday).toMatch(/^Today Mia /);
    expect(note.lineNext).toMatch(/^Next we'll /);
    expect(`${note.lineToday} ${note.lineNext}`).not.toMatch(/\[name\]|tier|\d+ of \d+/i);
  });

  it("under 3 notes say in the water with you", () => {
    expect(onDeckLine(undefined, "Ivy", true)).toBe("In the water with Ivy: you");
    expect(onDeckLine({ adult: { kind: "parent", name: "Jordan" } } as never, "Mia", false)).toBe("On deck: you");
    expect(onDeckLine({ adult: { kind: "listed-adult", listedAdultId: "a", firstName: "Rose", isParentOrGuardian: false } } as never, "Mia", false)).toBe("On deck: Rose");
  });
});
