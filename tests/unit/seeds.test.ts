import { describe, expect, it } from "vitest";

import { BUCKHEAD, buildSeed, MADISON, MOVING_FAMILY_ID } from "@/sandbox/seed";
import { cardPriceCents } from "@/rules/prices";
import { PATH_STAGES } from "@/content/path";

const data = buildSeed();

describe("seeds", () => {
  it("two pools with youngest ages and SAMPLE first-lesson notes", () => {
    expect(data.pools.map((p) => p.name)).toEqual(["Madison", "Buckhead"]);
    const madison = data.pools.find((p) => p.id === MADISON)!;
    const buckhead = data.pools.find((p) => p.id === BUCKHEAD)!;
    expect(madison.youngestAgeMonths).toBe(24);
    expect(buckhead.youngestAgeMonths).toBe(30);
    expect(madison.swimmersPerLesson).toEqual([1, 2]);
    expect(buckhead.swimmersPerLesson).toEqual([1, 2]);
    expect(buckhead.opensOn).toBe("2026-11-08");
    for (const p of data.pools) {
      for (const k of ["address", "parking", "door", "arrive", "waitOnDeck"] as const) expect(p.firstLesson[k].length).toBeGreaterThan(10);
      expect(p.firstLesson.bring.length).toBeGreaterThanOrEqual(3);
      expect(p.schoolEmail).toMatch(/@example\.com$/);
      expect(p.firstLesson.address).toMatch(/Example Way/);
    }
  });

  it("about 8 classes with stage, ages, day, time, coach, spots and both prices", () => {
    expect(data.classes.length).toBeGreaterThanOrEqual(8);
    expect(data.classes.length).toBeLessThanOrEqual(10);
    for (const c of data.classes) {
      const lt = data.lessonTypes.find((l) => l.id === c.lessonTypeId)!;
      expect(lt.poolId).toBe(c.poolId);
      if (lt.kind === "semi-private") expect(PATH_STAGES.map((s) => s.id)).toContain(c.stageId);
      else expect(c.stageId).toBeNull();
      expect(c.minAgeMonths).toBeLessThan(c.maxAgeMonths);
      expect(c.weekday).toBeGreaterThanOrEqual(0);
      expect(c.startTime).toMatch(/^\d{2}:\d{2}$/);
      expect(c.instructorFirstName).toMatch(/^[A-Z][a-z]+$/);
      expect(c.openSpots).toBeLessThanOrEqual(c.capacity);
      expect(c.capacity).toBe(lt.maxSwimmers);
      expect(c.slotMinutes).toBe(30);
      expect(c.lessonMinutes).toBe(27);
      expect(cardPriceCents(lt.bankDraftCents)).toBeGreaterThan(lt.bankDraftCents);
    }
    expect(new Set(data.classes.map((c) => c.poolId))).toEqual(new Set([MADISON, BUCKHEAD]));
  });

  it("one full class and one semi-private class with one child and one open spot", () => {
    expect(data.classes.filter((c) => c.openSpots === 0).length).toBeGreaterThanOrEqual(1);
    const halfFull = data.classes.filter((c) => {
      const lt = data.lessonTypes.find((l) => l.id === c.lessonTypeId)!;
      const kids = data.enrollments.filter((e) => e.timeId === c.id).length;
      return lt.kind === "semi-private" && c.capacity === 2 && c.openSpots === 1 && kids === 1;
    });
    expect(halfFull.length).toBeGreaterThanOrEqual(1);
    // Spots match the children enrolled.
    for (const c of data.classes) expect(c.capacity - c.openSpots).toBe(data.enrollments.filter((e) => e.timeId === c.id).length);
  });

  it("under-3 private times with a parent in the water, never in a shared class", () => {
    for (const pool of data.pools) {
      const under3 = data.classes.filter((c) => c.poolId === pool.id && c.minAgeMonths < 36);
      expect(under3.length).toBeGreaterThanOrEqual(1);
      for (const c of under3) {
        expect(data.lessonTypes.find((l) => l.id === c.lessonTypeId)!.kind).toBe("private");
        expect(c.parentInWater).toBe(true);
        expect(c.maxAgeMonths).toBeLessThan(36);
      }
    }
    for (const c of data.classes.filter((c) => data.lessonTypes.find((l) => l.id === c.lessonTypeId)!.kind === "semi-private")) {
      expect(c.minAgeMonths).toBeGreaterThanOrEqual(36);
    }
  });

  it("free evaluation times at each pool", () => {
    for (const pool of data.pools) expect(data.evaluationTimes.filter((e) => e.poolId === pool.id).length).toBeGreaterThanOrEqual(2);
  });

  it("moving-over family: one parent, two contacts, two Madison children, one Waiting adult, nothing signed, no bank", () => {
    const moving = data.families.filter((f) => f.source === "moving-over");
    expect(moving).toHaveLength(1);
    const fam = moving[0];
    expect(fam.id).toBe(MOVING_FAMILY_ID);
    expect(data.emergencyContacts.filter((c) => c.familyId === fam.id)).toHaveLength(2);
    const kids = data.children.filter((c) => c.familyId === fam.id);
    expect(kids).toHaveLength(2);
    for (const k of kids) {
      const e = data.enrollments.filter((x) => x.childRecordId === k.id);
      expect(e).toHaveLength(1);
      expect(e[0].poolId).toBe(MADISON);
      expect(e[0].lessonTypeId).not.toBeNull();
    }
    const adults = data.listedAdults.filter((a) => a.familyId === fam.id);
    expect(adults).toHaveLength(1);
    expect(adults[0].status).toBe("waiting");
    expect(data.releaseSignatures.filter((s) => s.familyId === fam.id)).toHaveLength(0);
    expect(data.paymentMethods.filter((p) => p.familyId === fam.id)).toHaveLength(0);
    expect(data.bankDraftAuthorizations.filter((p) => p.familyId === fam.id)).toHaveLength(0);
    expect(fam.confirmedEmail).toBeNull();
  });

  it("about 6 coach-line templates per stage, two lines each", () => {
    for (const s of PATH_STAGES) {
      const lines = data.coachLineTemplates.filter((t) => t.stageId === s.id);
      expect(lines.length).toBeGreaterThanOrEqual(5);
      expect(lines.length).toBeLessThanOrEqual(7);
      for (const l of lines) {
        expect(l.today).toMatch(/^Today \[name\] /);
        expect(l.next).toMatch(/^Next we'll /);
      }
    }
  });

  it("sample emails end in @example.com and phones use 555", () => {
    const json = JSON.stringify(data);
    for (const email of json.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]+/g) ?? []) expect(email).toMatch(/@example\.com$/);
    for (const f of data.families) expect(f.phone).toMatch(/^\d{3}-555-\d{4}$/);
    for (const c of data.emergencyContacts) expect(c.phone).toMatch(/^\d{3}-555-\d{4}$/);
  });
});
