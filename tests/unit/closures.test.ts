import { describe, expect, it } from "vitest";

import { LocalStore } from "@/data/store";
import { signAndSave } from "@/rules/booking";
import { closedDates } from "@/rules/closures";
import { firstOpenLessonDate } from "@/rules/dates";
import { familyLessons, lessonDaysAhead, upcomingLessonDate } from "@/rules/family";
import { timesForChild } from "@/rules/times";
import { buildSeed, BUCKHEAD, MADISON } from "@/sandbox/seed";

import { completeDraft, memoryStorage, testId } from "./helpers";

const data = buildSeed();

async function signUpOn(today: string) {
  const store = new LocalStore({ seedVersion: "t", seed: buildSeed, storage: memoryStorage() });
  const draft = completeDraft({});
  await store.transaction((tx) => tx.add("signUpDrafts", draft));
  const { familyId } = await store.transaction((tx) => signAndSave(tx, { draft, today, now: `${today}T15:00:00.000Z`, browserName: "Chrome", newId: testId }));
  return { store, familyId };
}

describe("closed days", () => {
  it("are seeded for each pool and marked sample", () => {
    for (const pool of [MADISON, BUCKHEAD]) expect(closedDates(data, pool).length).toBeGreaterThanOrEqual(2);
    for (const c of data.closures) expect(c.reason).toMatch(/\(sample\)$/);
    expect(closedDates(data, MADISON)).toContain("2026-11-29");
  });

  it("a first lesson never lands on a closed day", async () => {
    expect(firstOpenLessonDate(0, "2026-11-26", null, ["2026-11-29"])).toBe("2026-12-06");
    expect(firstOpenLessonDate(0, "2026-11-26", null, ["2026-11-29", "2026-12-06"])).toBe("2026-12-13");
    const t = timesForChild({ data, poolId: MADISON, birthDate: "2022-07-30", stage: "shallows", today: "2026-11-26" });
    expect(t.classes.find((c) => c.id === "mad-sun-1000-shallows")!.firstLessonDate).toBe("2026-12-06");
    const { store, familyId } = await signUpOn("2026-11-26");
    expect(familyLessons(await store.snapshot(), familyId)[0].firstLessonDate).toBe("2026-12-06");
  });

  it("the next lesson skips a closed day", async () => {
    const { store, familyId } = await signUpOn("2026-11-19");
    const after = await store.snapshot();
    const [lesson] = familyLessons(after, familyId);
    expect(lesson.firstLessonDate).toBe("2026-11-22");
    // The week after the first lesson is the holiday weekend: the next lesson is the Sunday after.
    expect(upcomingLessonDate(after, lesson, "2026-11-23")).toBe("2026-12-06");
  });

  it("lesson dates list the weeks ahead with closed days marked", async () => {
    const { store, familyId } = await signUpOn("2026-10-30");
    const snap = await store.snapshot();
    const days = lessonDaysAhead(snap, familyLessons(snap, familyId)[0], "2026-10-30", 9);
    expect(days.map((d) => d.date)).toEqual(["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29", "2026-12-06", "2026-12-13", "2026-12-20", "2026-12-27"]);
    expect(days.filter((d) => d.closedReason).map((d) => d.date)).toEqual(["2026-11-29", "2026-12-27"]);
  });
});
