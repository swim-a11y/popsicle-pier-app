import { describe, expect, it } from "vitest";

import { LocalStore } from "@/data/store";
import { signAndSave } from "@/rules/booking";
import { familyLessons } from "@/rules/family";
import { leaveClass } from "@/rules/offers";
import { firstMonthEnds, partnerNoticeNow, partnerNoticeWords, sendPartnerNotice, unpairedItems } from "@/rules/partners";
import { buildSeed, MOVING_FAMILY_ID } from "@/sandbox/seed";

import { completeDraft, memoryStorage, NOW, testId, TODAY } from "./helpers";

const flat = (s: string) => s.replace(/\s+/g, " ");

/** Theo, in the family moving over, has been the only child in the Wednesday 5:00 Cove class at Madison since Wednesday, October 7. */
async function seeded() {
  return new LocalStore({ seedVersion: "t", seed: buildSeed, storage: memoryStorage() });
}

const theoClass = (data: Awaited<ReturnType<LocalStore["snapshot"]>>) => familyLessons(data, MOVING_FAMILY_ID).find((l) => l.child.firstName === "Theo")!;

describe("no partner after the first month", () => {
  it("a semi-private class with no partner waits out its first month, then a note is due", async () => {
    const store = await seeded();
    const data = await store.snapshot();
    expect(firstMonthEnds("2026-10-07")).toBe("2026-11-07");
    expect(unpairedItems(data, TODAY)).toEqual([]);
    expect(unpairedItems(data, "2026-11-06")).toEqual([]);
    const [item] = unpairedItems(data, "2026-11-07");
    expect([item.child.firstName, item.since, item.monthEnded, item.before]).toEqual(["Theo", "2026-10-07", "2026-11-06", "2026-12-02"]);
    // Juniper's class has two children, so it isn't on the list.
    expect(unpairedItems(data, "2026-12-30").map((i) => i.child.firstName)).toEqual(["Theo"]);
  });

  it("the note says what happened, opens a talk, and that nothing changes for three weeks: no new price, no partner named", async () => {
    const store = await seeded();
    const [item] = unpairedItems(await store.snapshot(), "2026-11-09");
    expect(flat(partnerNoticeWords({ childFirstName: "Theo", cls: item.cls, pool: item.pool, since: item.since, before: item.before, today: "2026-11-09" }))).toBe(
      "Theo has had no partner in the Wednesday 5:00 pm class at Madison, with Coach Tamsin, since Wednesday, October 7. The first month at the semi-private price has passed, and we haven't found a partner yet. We'd like to talk with you about what comes next: email us at madison.sample@example.com. Nothing about Theo's class or its price changes before Wednesday, December 2.",
    );
  });

  it("a person sends it; the class and its price stay as they are, and nothing more is due for that stretch", async () => {
    const store = await seeded();
    const before = theoClass(await store.snapshot());
    const notice = await store.transaction((tx) => sendPartnerNotice(tx, { enrollmentId: before.enrollment.id, today: "2026-11-09", now: "2026-11-09T17:00:00.000Z", newId: testId }));
    const data = await store.snapshot();
    expect([notice.unpairedSince, notice.nothingChangesBefore, notice.sentBy]).toEqual(["2026-10-07", "2026-12-02", "the school"]);
    expect(unpairedItems(data, "2026-11-09")).toEqual([]);
    const after = theoClass(data);
    expect([after.enrollment.lessonTypeId, after.enrollment.unpairedSince, after.bankCents]).toEqual([before.enrollment.lessonTypeId, "2026-10-07", before.bankCents]);
    expect(partnerNoticeNow(data, notice)).toBe("unpaired");
    // Sending twice isn't possible.
    await expect(store.transaction((tx) => sendPartnerNotice(tx, { enrollmentId: before.enrollment.id, today: "2026-11-09", now: NOW, newId: testId }))).rejects.toThrow(
      "This class isn't waiting for a note anymore.",
    );
  });

  it("a partner joining ends it; a partner leaving starts the month again", async () => {
    const store = await seeded();
    const theo = theoClass(await store.snapshot());
    const notice = await store.transaction((tx) => sendPartnerNotice(tx, { enrollmentId: theo.enrollment.id, today: "2026-11-09", now: "2026-11-09T17:00:00.000Z", newId: testId }));
    // A family books the open Wednesday 5:00 spot for Rae.
    const draft = completeDraft({ id: "draft-rae", kids: [{ firstName: "Rae", birth: "2019-05-01", stage: "cove", booking: { kind: "class", timeId: "mad-wed-1700-cove" } }] });
    await store.transaction((tx) => tx.add("signUpDrafts", draft));
    const { familyId } = await store.transaction((tx) => signAndSave(tx, { draft, today: TODAY, now: NOW, browserName: "Chrome", newId: testId }));
    let data = await store.snapshot();
    expect(partnerNoticeNow(data, notice)).toBe("partner");
    expect(unpairedItems(data, "2026-12-30")).toEqual([]);
    // Rae leaves on Friday, November 20: Theo's month starts again from his next lesson, Wednesday, December 2 (November 25 is a closed day).
    const rae = familyLessons(data, familyId)[0];
    await store.transaction((tx) => leaveClass(tx, rae.enrollment.id, "2026-11-20"));
    data = await store.snapshot();
    expect(theoClass(data).enrollment.unpairedSince).toBe("2026-12-02");
    expect(unpairedItems(data, "2027-01-01")).toEqual([]);
    expect(unpairedItems(data, "2027-01-02").map((i) => [i.child.firstName, i.since])).toEqual([["Theo", "2026-12-02"]]);
    // The earlier note was about the earlier stretch.
    expect(partnerNoticeNow(data, notice)).toBe("partner");
  });

  it("nothing changes before a real lesson: a closed day three weeks on moves it a week", async () => {
    const store = await seeded();
    // Sent Wednesday, December 9: three weeks on is Wednesday, December 30, a closed day at Madison.
    const [item] = unpairedItems(await store.snapshot(), "2026-12-09");
    expect(item.before).toBe("2027-01-06");
  });

  it("only a class still running: none for a class the family has left", async () => {
    const store = await seeded();
    const theo = theoClass(await store.snapshot());
    await store.transaction((tx) => leaveClass(tx, theo.enrollment.id, TODAY));
    expect(unpairedItems(await store.snapshot(), "2026-12-30")).toEqual([]);
  });
});
