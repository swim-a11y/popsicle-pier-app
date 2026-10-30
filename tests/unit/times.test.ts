import { describe, expect, it } from "vitest";

import { NO_PARTNER_YET } from "@/content/sign-up";
import { timesForChild } from "@/rules/times";
import { buildSeed, BUCKHEAD, MADISON } from "@/sandbox/seed";

const data = buildSeed();
const TODAY = "2026-10-30";

describe("times", () => {
  it("only times that fit the child's age and stage at that pool", () => {
    const four = "2022-07-30";
    const shallows = timesForChild({ data, poolId: MADISON, birthDate: four, stage: "shallows", today: TODAY });
    expect(shallows.classes.map((c) => c.id)).toEqual(["mad-sun-1000-shallows", "mad-wed-1630-shallows"]);
    const pier = timesForChild({ data, poolId: MADISON, birthDate: four, stage: "pier", today: TODAY });
    expect(pier.classes.map((c) => c.id)).toEqual(["mad-sun-0930-pier"]);
    for (const c of [...shallows.classes, ...pier.classes]) {
      expect(c.poolId).toBe(MADISON);
      expect(c.bankCents).toBeGreaterThan(0);
      expect(c.cardCents).toBeGreaterThan(c.bankCents!);
    }
    // "Not sure? Free evaluation" lists evaluations only.
    const unsure = timesForChild({ data, poolId: MADISON, birthDate: four, stage: "evaluation", today: TODAY });
    expect(unsure.classes).toHaveLength(0);
    expect(unsure.evaluations.length).toBeGreaterThan(0);
    for (const e of unsure.evaluations) expect(e.bankCents).toBeNull();
  });

  it("full times are marked Full and can't be booked", () => {
    const t = timesForChild({ data, poolId: BUCKHEAD, birthDate: "2020-06-01", stage: "cove", today: TODAY });
    expect(t.classes[0].id).toBe("buc-sun-0900-cove");
    expect(t.classes[0].full).toBe(true);
    expect(t.classes[0].spotsLeft).toBe(0);
    expect(t.classes[1].full).toBe(false);
    expect(t.nothingFits).toBe(false);
  });

  it("times next to a sibling's are marked", () => {
    const t = timesForChild({
      data,
      poolId: BUCKHEAD,
      birthDate: "2020-06-01",
      stage: "cove",
      today: TODAY,
      siblings: [{ name: "Leo", booking: { kind: "class", timeId: "buc-sun-0930-pier" } }],
    });
    const ten = t.classes.find((c) => c.id === "buc-sun-1000-cove")!;
    expect(ten.sibling).toEqual({ name: "Leo", relation: "next-to" });
    const same = timesForChild({
      data,
      poolId: MADISON,
      birthDate: "2022-07-30",
      stage: "shallows",
      today: TODAY,
      siblings: [{ name: "Ada", booking: { kind: "class", timeId: "mad-sun-1000-shallows" } }],
    });
    // A sibling picking the same semi-private time takes a spot and is the partner.
    const tenAm = same.classes.find((c) => c.id === "mad-sun-1000-shallows")!;
    expect(tenAm.sibling?.relation).toBe("same-time");
    expect(tenAm.spotsLeft).toBe(1);
    expect(tenAm.noPartnerYet).toBe(false);
  });

  it("nothing fits offers the waitlist and the free evaluation", () => {
    const t = timesForChild({ data, poolId: BUCKHEAD, birthDate: "2018-04-01", stage: "open-water", today: TODAY });
    expect(t.classes).toHaveLength(0);
    expect(t.nothingFits).toBe(true);
    expect(t.evaluations.length).toBeGreaterThan(0);
  });

  it("a semi-private time with no partner yet carries the no-partner words", () => {
    const t = timesForChild({ data, poolId: MADISON, birthDate: "2022-07-30", stage: "shallows", today: TODAY });
    expect(t.classes.find((c) => c.id === "mad-sun-1000-shallows")!.noPartnerYet).toBe(true);
    const cove = timesForChild({ data, poolId: MADISON, birthDate: "2019-09-09", stage: "cove", today: TODAY });
    const withOne = cove.classes.find((c) => c.id === "mad-wed-1700-cove")!;
    expect(withOne.noPartnerYet).toBe(false);
    expect(withOne.spotsLeft).toBe(1);
    expect(NO_PARTNER_YET).toBe(
      "No partner yet. You pay the semi-private price for the first month. If we haven't found a partner by then, we'll talk with you before anything changes.",
    );
  });
});
