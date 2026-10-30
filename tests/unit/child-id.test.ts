import { describe, expect, it } from "vitest";

import { LocalStore } from "@/data/store";
import { signAndSave } from "@/rules/booking";
import { CHILD_ID_PATTERN, ensureChildId, formatChildId } from "@/rules/child-id";
import { buildSeed } from "@/sandbox/seed";

import { completeDraft, memoryStorage, NOW, testId, TODAY } from "./helpers";

async function signUp(store: LocalStore, draft: ReturnType<typeof completeDraft>) {
  await store.transaction((tx) => tx.add("signUpDrafts", draft));
  return store.transaction((tx) => signAndSave(tx, { draft, today: TODAY, now: NOW, browserName: "Chrome", newId: testId }));
}

describe("child IDs", () => {
  it("format PP, two-digit year, hyphen, four-digit serial", () => {
    expect(formatChildId(2026, 42)).toBe("PP26-0042");
    expect(formatChildId(2027, 7)).toBe("PP27-0007");
    expect("PP26-0042").toMatch(new RegExp(`^${CHILD_ID_PATTERN.source}$`));
    for (const c of buildSeed().children) expect(c.childId).toMatch(/^PP\d{2}-\d{4}$/);
  });

  it("one counter across both pools, first new child is PP26-0042", async () => {
    const store = new LocalStore({ seedVersion: "t", seed: buildSeed, storage: memoryStorage() });
    const a = await signUp(store, completeDraft({}));
    const b = await signUp(
      store,
      completeDraft({ poolId: "pool-buckhead", kids: [{ firstName: "Leo", birth: "2023-03-01", stage: "pier", booking: { kind: "class", timeId: "buc-sun-0930-pier" } }] }),
    );
    const data = await store.snapshot();
    expect(data.children.find((c) => c.familyId === a.familyId)!.childId).toBe("PP26-0042");
    expect(data.children.find((c) => c.familyId === b.familyId)!.childId).toBe("PP26-0043");
    // The free evaluation counts as a first booking too.
    const e = await signUp(
      store,
      completeDraft({ kids: [{ firstName: "Ivy", birth: "2022-01-01", stage: "evaluation", booking: { kind: "evaluation", timeId: "mad-eval-sun-1100" } }], payment: "hold" }),
    );
    expect((await store.snapshot()).children.find((c) => c.familyId === e.familyId)!.childId).toBe("PP26-0044");
    // A child only on a waitlist isn't booked yet, so has no ID.
    const w = await signUp(
      store,
      completeDraft({ kids: [{ firstName: "Bo", birth: "2021-01-01", stage: "shallows", booking: null, waitlist: ["mad-wed-1630-shallows"] }], payment: "none" }),
    );
    expect((await store.snapshot()).children.find((c) => c.familyId === w.familyId)!.childId).toBeNull();
  });

  it("never reused, even after a child leaves", async () => {
    const store = new LocalStore({ seedVersion: "t", seed: buildSeed, storage: memoryStorage() });
    const seeded = (await store.snapshot()).children.map((c) => Number(c.childId!.slice(5)));
    expect(Math.max(...seeded)).toBeLessThan(42);
    const a = await signUp(store, completeDraft({}));
    const first = (await store.snapshot()).children.find((c) => c.familyId === a.familyId)!;
    // That child leaves: their lessons end. The ID stays theirs and the counter only moves on.
    await store.transaction((tx) => {
      for (const e of tx.list("enrollments").filter((x) => x.childRecordId === first.id)) tx.remove("enrollments", e.id);
    });
    const b = await signUp(store, completeDraft({ kids: [{ firstName: "Lou", birth: "2022-02-02", stage: "pier", booking: { kind: "class", timeId: "mad-sun-0930-pier" } }] }));
    const data = await store.snapshot();
    expect(data.children.find((c) => c.id === first.id)!.childId).toBe("PP26-0042");
    expect(data.children.find((c) => c.familyId === b.familyId)!.childId).toBe("PP26-0043");
    const ids = data.children.map((c) => c.childId).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("a child booked at the other pool keeps one ID", async () => {
    const store = new LocalStore({ seedVersion: "t", seed: buildSeed, storage: memoryStorage() });
    const a = await signUp(store, completeDraft({}));
    const child = (await store.snapshot()).children.find((c) => c.familyId === a.familyId)!;
    const again = await store.transaction((tx) => {
      // Later booked at Buckhead: same child record, same ID; the stage can change too.
      tx.update("children", child.id, { stageId: "cove" });
      return ensureChildId(tx, child.id, "2027-02-01");
    });
    expect(again).toBe("PP26-0042");
    const data = await store.snapshot();
    expect(data.counters.find((c) => c.id === "child-serial")!.next).toBe(43);
    expect(data.children.find((c) => c.id === child.id)!.childId).toBe("PP26-0042");
  });
});
