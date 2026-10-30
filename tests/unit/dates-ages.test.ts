import { describe, expect, it } from "vitest";

import { PATH_STAGES } from "@/content/path";
import { SWIM_DIAPER_LINE } from "@/content/sign-up";
import { newId } from "@/data/ids";
import { addMonths, ageInMonths, firstLessonDate, isThreeAndUnder, shownAtSchool, todayAtSchool, weekdayOf } from "@/rules/dates";
import { timesForChild } from "@/rules/times";
import { buildSeed, BUCKHEAD, MADISON } from "@/sandbox/seed";

const data = buildSeed();
const TODAY = "2026-10-30"; // a Friday

describe("ages", () => {
  it("age is figured on the first lesson date", () => {
    // Turns 4 on Tuesday, November 3, 2026.
    const birth = "2022-11-03";
    const sunday = firstLessonDate(0, TODAY, null);
    const wednesday = firstLessonDate(3, TODAY, null);
    expect(sunday).toBe("2026-11-01");
    expect(wednesday).toBe("2026-11-04");
    expect(ageInMonths(birth, sunday)).toBe(47);
    expect(ageInMonths(birth, wednesday)).toBe(48);
    // Same child: The Shallows on Wednesday (ages 4 and up) fits, Sunday's age range still does too.
    const times = timesForChild({ data, poolId: MADISON, birthDate: birth, stage: "shallows", today: TODAY });
    expect(times.classes.map((c) => c.id)).toEqual(["mad-sun-1000-shallows", "mad-wed-1630-shallows"]);
  });

  it("youngest age: Madison 2, Buckhead 2 and a half, and the start date when too young", () => {
    const birth = "2024-07-15"; // 27 months on Nov 8, 2026
    const atBuckhead = timesForChild({ data, poolId: BUCKHEAD, birthDate: birth, stage: "pier", today: TODAY });
    expect(atBuckhead.tooYoung).toEqual({ canStartOn: addMonths(birth, 30), youngestAgeMonths: 30 });
    expect(atBuckhead.tooYoung?.canStartOn).toBe("2027-01-15");
    expect(atBuckhead.classes).toHaveLength(0);
    const atMadison = timesForChild({ data, poolId: MADISON, birthDate: birth, stage: "pier", today: TODAY });
    expect(atMadison.tooYoung).toBeNull();
    expect(atMadison.classes.length).toBeGreaterThan(0);
    const tooYoungForMadison = timesForChild({ data, poolId: MADISON, birthDate: "2025-01-10", stage: "pier", today: TODAY });
    expect(tooYoungForMadison.tooYoung?.canStartOn).toBe("2027-01-10");
  });

  it("under 3 means private with a parent in the water", () => {
    const t = timesForChild({ data, poolId: MADISON, birthDate: "2024-03-20", stage: "pier", today: TODAY });
    expect(t.under3).toBe(true);
    expect(t.classes.length).toBeGreaterThan(0);
    for (const c of t.classes) {
      expect(c.lessonKind).toBe("private");
      expect(c.parentInWater).toBe(true);
    }
    expect(t.evaluations.length).toBeGreaterThan(0);
    for (const e of t.evaluations) expect(e.parentInWater).toBe(true);
  });

  it("3 and under gets the swim diaper line", () => {
    expect(isThreeAndUnder(47)).toBe(true);
    expect(isThreeAndUnder(48)).toBe(false);
    expect(SWIM_DIAPER_LINE).toBe("Every child 3 and under, and any child who isn't toilet-trained, wears a snug reusable swim diaper.");
  });
});

describe("dates", () => {
  it("first lesson is the first class day at least 2 days out", () => {
    expect(firstLessonDate(0, "2026-10-30", null)).toBe("2026-11-01");
    expect(firstLessonDate(0, "2026-10-31", null)).toBe("2026-11-08");
    expect(firstLessonDate(5, "2026-10-30", null)).toBe("2026-11-06");
    expect(firstLessonDate(6, "2026-10-30", null)).toBe("2026-11-07");
    for (let wd = 0; wd < 7; wd++) {
      const d = firstLessonDate(wd, TODAY, null);
      expect(weekdayOf(d)).toBe(wd);
      expect(d >= "2026-11-01").toBe(true);
    }
  });

  it("no Buckhead lesson before Sunday, November 8, 2026", () => {
    const buckhead = data.pools.find((p) => p.id === BUCKHEAD)!;
    for (const today of ["2026-10-01", "2026-10-30", "2026-11-05"]) {
      for (const c of data.classes.filter((c) => c.poolId === BUCKHEAD)) {
        expect(firstLessonDate(c.weekday, today, buckhead.opensOn) >= "2026-11-08").toBe(true);
      }
    }
    expect(firstLessonDate(0, "2026-10-30", buckhead.opensOn)).toBe("2026-11-08");
    expect(weekdayOf("2026-11-08")).toBe(0);
    const t = timesForChild({ data, poolId: BUCKHEAD, birthDate: "2020-05-05", stage: "cove", today: TODAY });
    for (const c of [...t.classes, ...t.evaluations]) expect(c.firstLessonDate >= "2026-11-08").toBe(true);
  });

  it("stored times are UTC and shown in New York", () => {
    expect(shownAtSchool("2026-10-30T15:02:00.000Z")).toBe("October 30, 2026 at 11:02 am");
    expect(todayAtSchool(new Date("2026-10-31T02:00:00.000Z"))).toBe("2026-10-30");
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(data.classes.every((c) => !/[0-9a-f]{8}-/.test(c.id))).toBe(true);
  });
});

describe("stages", () => {
  it("Path stages in order", () => {
    expect(PATH_STAGES.map((s) => s.name)).toEqual(["The Pier", "The Shallows", "The Cove", "Open Water"]);
  });
});
