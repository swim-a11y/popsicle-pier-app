import { describe, expect, it } from "vitest";

import { LocalStore } from "@/data/store";
import { signAndSave } from "@/rules/booking";
import { lessonDaysAhead, familyLessons } from "@/rules/family";
import { markNoteRead, missNoted, missOptions, NOTE_CHOICES, noteWords, notesForFamily, NoteProblemError, sendNote } from "@/rules/notes";
import { buildSeed } from "@/sandbox/seed";

import { completeDraft, memoryStorage, NOW, testId, TODAY } from "./helpers";

const flat = (s: string) => s.replace(/\s+/g, " ");

async function familyWithMia() {
  const store = new LocalStore({ seedVersion: "t", seed: buildSeed, storage: memoryStorage() });
  const draft = completeDraft({});
  await store.transaction((tx) => tx.add("signUpDrafts", draft));
  const { familyId } = await store.transaction((tx) => signAndSave(tx, { draft, today: TODAY, now: NOW, browserName: "Chrome", newId: testId }));
  const data = await store.snapshot();
  const mia = data.children.find((c) => c.familyId === familyId)!;
  return { store, familyId, mia };
}

describe("tap-to-send notes", () => {
  it("three ready-made notes, no free text", () => {
    expect(NOTE_CHOICES.map((c) => c.kind)).toEqual(["miss", "move", "stop"]);
    expect(flat(noteWords("miss", "Mia", "2026-11-08"))).toBe("We'll miss Mia's lesson on Sunday, November 8.");
    expect(noteWords("move", "Mia", null)).toBe("We'd like to talk about a different lesson time for Mia.");
    expect(noteWords("stop", "Mia", null)).toBe("We'd like to talk about stopping Mia's lessons.");
    // sendNote takes no words: the app writes them.
    expect(sendNote.length).toBe(2);
  });

  it("a miss is picked from the child's lesson dates, never a closed day", async () => {
    const { store, familyId, mia } = await familyWithMia();
    const options = missOptions(await store.snapshot(), familyId, mia.id, TODAY);
    expect(options.map((o) => o.date)).toEqual(["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22", "2026-12-06"]);
    const enrollmentId = options[1].enrollmentId;
    const note = await store.transaction((tx) => sendNote(tx, { familyId, childRecordId: mia.id, kind: "miss", enrollmentId, lessonDate: "2026-11-08", today: TODAY, now: NOW, newId: testId }));
    expect(flat(note.words)).toBe("We'll miss Mia's lesson on Sunday, November 8.");
    expect(note).toMatchObject({ readAt: null, readBy: null, kind: "miss", lessonDate: "2026-11-08" });
    const data = await store.snapshot();
    expect(missNoted(data, enrollmentId, "2026-11-08")).toBe(true);
    expect(missOptions(data, familyId, mia.id, TODAY).map((o) => o.date)).not.toContain("2026-11-08");
    // The same date twice, or a closed day, is refused.
    for (const lessonDate of ["2026-11-08", "2026-11-29"]) {
      await expect(store.transaction((tx) => sendNote(tx, { familyId, childRecordId: mia.id, kind: "miss", enrollmentId, lessonDate, today: TODAY, now: NOW, newId: testId }))).rejects.toThrow(NoteProblemError);
    }
    // Lesson dates still list the day; the screen marks it from the note.
    const days = lessonDaysAhead(data, familyLessons(data, familyId)[0], TODAY, 6).map((d) => d.date);
    expect(days).toContain("2026-11-08");
  });

  it("a move or stop note is sent once until a person reads it", async () => {
    const { store, familyId, mia } = await familyWithMia();
    const send = () => store.transaction((tx) => sendNote(tx, { familyId, childRecordId: mia.id, kind: "move", today: TODAY, now: NOW, newId: testId }));
    const first = await send();
    const again = await send();
    expect(again.id).toBe(first.id);
    expect(notesForFamily(await store.snapshot(), familyId)).toHaveLength(1);
    const read = await store.transaction((tx) => markNoteRead(tx, { noteId: first.id, now: "2026-10-31T14:00:00.000Z", by: "the school" }));
    expect(read).toMatchObject({ readAt: "2026-10-31T14:00:00.000Z", readBy: "the school" });
    expect((await send()).id).not.toBe(first.id);
  });

  it("only a family's own swimmers", async () => {
    const { store, familyId } = await familyWithMia();
    await expect(store.transaction((tx) => sendNote(tx, { familyId, childRecordId: "child-juniper", kind: "stop", today: TODAY, now: NOW, newId: testId }))).rejects.toThrow("Pick one of your swimmers.");
  });
});
