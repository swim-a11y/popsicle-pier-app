import { describe, expect, it } from "vitest";

import { LocalStore } from "@/data/store";
import { signAndSave } from "@/rules/booking";
import { firstBillMonth, monthBill, upcomingBills } from "@/rules/bills";
import { approveOwedCredit, cancelClassDate } from "@/rules/owed";
import { buildSeed, MOVING_FAMILY_ID } from "@/sandbox/seed";

import { completeDraft, memoryStorage, NOW, testId, TODAY } from "./helpers";

async function signedUp(draft = completeDraft({})) {
  const store = new LocalStore({ seedVersion: "t", seed: buildSeed, storage: memoryStorage() });
  await store.transaction((tx) => tx.add("signUpDrafts", draft));
  const { familyId } = await store.transaction((tx) => signAndSave(tx, { draft, today: TODAY, now: NOW, browserName: "Chrome", newId: testId }));
  return { store, familyId };
}

describe("bills, lessons only", () => {
  it("each month's lessons times the lesson price, both prices on every line, closed days not billed", async () => {
    const { store, familyId } = await signedUp();
    const bills = upcomingBills(await store.snapshot(), familyId, TODAY);
    expect(bills.map((b) => b.month)).toEqual(["2026-11-01", "2026-12-01"]);
    const [nov, dec] = bills;
    expect(nov.lines).toHaveLength(1);
    const line = nov.lines[0];
    expect(line.lesson.child.firstName).toBe("Mia");
    expect(line.billed).toEqual(["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22"]);
    expect(line.closed).toEqual([{ date: "2026-11-29", reason: "Closed for the holiday weekend (sample)" }]);
    expect([line.bankEach, line.cardEach, line.cardFeeEach]).toEqual([3400, 3500, 0]);
    expect([line.bankCents, line.cardCents]).toEqual([13600, 14000]);
    expect([nov.bankCents, nov.cardCents]).toEqual([13600, 14000]);
    expect(dec.lines[0].billed).toEqual(["2026-12-06", "2026-12-13", "2026-12-20"]);
    expect(dec.lines[0].closed.map((c) => c.date)).toEqual(["2026-12-27"]);
    expect(nov.pays).toEqual({ method: "bank", cents: 13600 });
  });

  it("reaches the family by the 19th, at least 10 days before the draft on the 1st", async () => {
    const { store, familyId } = await signedUp();
    const [nov, dec] = upcomingBills(await store.snapshot(), familyId, TODAY);
    // Joined after October 19: the first bill goes out the day they signed up, and its draft waits 10 days.
    expect([nov.billDate, nov.draftDate]).toEqual(["2026-10-30", "2026-11-09"]);
    expect([dec.billDate, dec.draftDate]).toEqual(["2026-11-19", "2026-12-01"]);
  });

  it("a card family pays the card price; nothing fee-like in card price mode", async () => {
    const { store, familyId } = await signedUp(completeDraft({ payment: "card" }));
    const [nov] = upcomingBills(await store.snapshot(), familyId, TODAY);
    expect(nov.pays).toEqual({ method: "card", cents: 14000 });
    // "card fee" mode is one price plus a fee on cards, never both.
    const feeMode = monthBill(await store.snapshot(), familyId, "2026-11-01", "card fee");
    expect([feeMode.lines[0].cardEach, feeMode.lines[0].cardFeeEach]).toEqual([3400, 102]);
  });

  it("a free evaluation is never billed", async () => {
    const { store, familyId } = await signedUp(
      completeDraft({ kids: [{ firstName: "Wren", birth: "2024-06-01", stage: "evaluation", booking: { kind: "evaluation", timeId: "mad-eval-sun-1100" } }], payment: "hold" }),
    );
    expect(upcomingBills(await store.snapshot(), familyId, TODAY)).toEqual([]);
  });

  it("a family moving over is billed here from the first bill date after it moves over", async () => {
    const store = new LocalStore({ seedVersion: "t", seed: buildSeed, storage: memoryStorage() });
    expect(firstBillMonth(await store.snapshot(), MOVING_FAMILY_ID)).toBeNull();
    await store.transaction((tx) => tx.update("families", MOVING_FAMILY_ID, { movedOverAt: NOW }));
    expect(firstBillMonth(await store.snapshot(), MOVING_FAMILY_ID)).toBe("2026-12-01");
    await store.transaction((tx) => tx.update("families", MOVING_FAMILY_ID, { movedOverAt: "2026-10-12T15:00:00.000Z" }));
    expect(firstBillMonth(await store.snapshot(), MOVING_FAMILY_ID)).toBe("2026-11-01");
    const [nov] = upcomingBills(await store.snapshot(), MOVING_FAMILY_ID, TODAY);
    // Juniper and Theo, Wednesdays at Madison; the holiday Wednesday isn't billed.
    expect(nov.lines.map((l) => [l.lesson.child.firstName, l.billed.length, l.closed.length])).toEqual([
      ["Theo", 3, 1],
      ["Juniper", 3, 1],
    ]);
    expect(nov.pays).toBeNull();
  });

  it("a lesson the school cancels stays billed while it's owed, and comes off with the owner's credit", async () => {
    const { store, familyId } = await signedUp();
    const [owed] = await store.transaction((tx) => cancelClassDate(tx, { classId: "mad-sun-1000-shallows", date: "2026-11-08", reason: "Coach Dev is away that day (sample)", now: NOW, newId: testId }));
    let nov = monthBill(await store.snapshot(), familyId, "2026-11-01");
    expect(nov.lines[0].billed).toContain("2026-11-08");
    expect(nov.lines[0].cancelled).toEqual([{ date: "2026-11-08", credited: false }]);
    // A credit is only for when no opening exists: fill both of Coach Dev's private times first.
    await store.transaction((tx) => {
      for (const id of ["mad-eval-sun-1100", "mad-eval-sun-1130"]) tx.update("evaluationTimes", id, { openSpots: 0 });
    });
    await store.transaction((tx) => approveOwedCredit(tx, { owedId: owed.id, today: TODAY, now: NOW }));
    nov = monthBill(await store.snapshot(), familyId, "2026-11-01");
    expect(nov.lines[0].billed).not.toContain("2026-11-08");
    expect(nov.lines[0].cancelled).toEqual([{ date: "2026-11-08", credited: true }]);
    expect(nov.bankCents).toBe(3 * 3400);
  });
});
