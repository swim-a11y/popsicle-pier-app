import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { cardPricing, evaluationAsksForCard } from "@/config";
import { LocalStore } from "@/data/store";
import { signAndSave } from "@/rules/booking";
import { familyLessons, lessonInfo } from "@/rules/family";
import { cardPriceCents, money, priceLines } from "@/rules/prices";
import { buildSeed } from "@/sandbox/seed";

import { completeDraft, memoryStorage, NOW, testId, TODAY } from "./helpers";

describe("prices", () => {
  it("bank draft first, card about 3 percent more rounded to a quarter", () => {
    expect(cardPriceCents(3400, "card price")).toBe(3500);
    expect(cardPriceCents(4600, "card price")).toBe(4725);
    expect(cardPriceCents(3600, "card price")).toBe(3700);
    expect(cardPriceCents(4800, "card price")).toBe(4925);
    for (let bank = 1000; bank <= 9000; bank += 37) {
      const card = cardPriceCents(bank, "card price");
      expect(card % 25).toBe(0);
      expect(card).toBeLessThanOrEqual(bank * 1.03);
      expect(card).toBeGreaterThan(bank * 1.03 - 25);
    }
    const lines = priceLines(3400, "card price");
    expect(lines.map((l) => l.method)).toEqual(["bank", "card"]);
    expect(lines.map((l) => `${l.label} ${l.amount}`)).toEqual(["Bank draft $34.00", "Card $35.00"]);
    expect(money(4725)).toBe("$47.25");
  });

  it("card price wording has no fee or surcharge", () => {
    for (const bank of [3400, 3600, 4600, 4800]) {
      for (const line of priceLines(bank, "card price")) expect(`${line.label} ${line.amount}`).not.toMatch(/fee|surcharge/i);
    }
    // The other mode exists but is never both at once.
    const feeLines = priceLines(3400, "card fee");
    expect(feeLines[1].amount).toMatch(/card fee/);
    expect(cardPriceCents(3400, "card fee")).toBe(3400);
  });

  it("price comes from the lesson type and never changes when a partner joins or leaves", async () => {
    const store = new LocalStore({ seedVersion: "t", seed: buildSeed, storage: memoryStorage() });
    // Theo is alone in the Wednesday Cove class (no partner).
    const before = await store.snapshot();
    const theo = lessonInfo(before, before.enrollments.find((e) => e.id === "enr-theo")!)!;
    expect(theo.enrollment.unpairedSince).not.toBeNull();
    // A new family books the open spot next to him.
    const draft = completeDraft({ kids: [{ firstName: "Ada", birth: "2019-09-09", stage: "cove", booking: { kind: "class", timeId: "mad-wed-1700-cove" } }] });
    await store.transaction((tx) => tx.add("signUpDrafts", draft));
    const { familyId } = await store.transaction((tx) => signAndSave(tx, { draft, today: TODAY, now: NOW, browserName: "Chrome", newId: testId }));
    const after = await store.snapshot();
    const theoAfter = lessonInfo(after, after.enrollments.find((e) => e.id === "enr-theo")!)!;
    expect(theoAfter.bankCents).toBe(theo.bankCents);
    expect(theoAfter.cardCents).toBe(theo.cardCents);
    const ada = familyLessons(after, familyId)[0];
    expect(ada.bankCents).toBe(3400);
    // The partner leaving (the enrollment ending) changes no one's price either.
    await store.transaction((tx) => tx.remove("enrollments", ada.enrollment.id));
    const theoLater = lessonInfo(await store.snapshot(), after.enrollments.find((e) => e.id === "enr-theo")!)!;
    expect(theoLater.bankCents).toBe(theo.bankCents);
    // Nothing in the price rule reads partners.
    expect(readFileSync("src/rules/prices.ts", "utf8")).not.toMatch(/unpairedSince|enrollments/);
  });

  it("payment settings", () => {
    expect(cardPricing).toBe("card price");
    expect(evaluationAsksForCard).toBe(true);
    const config = readFileSync("src/config.ts", "utf8");
    expect(config).toContain('export const cardPricing: CardPricing = "card price";');
    expect(config).toContain("export const evaluationAsksForCard: boolean = true;");
    const decisions = readFileSync("DECISIONS.md", "utf8");
    expect(decisions).toContain("cardPricing");
    expect(decisions).toContain("evaluationAsksForCard");
  });
});
