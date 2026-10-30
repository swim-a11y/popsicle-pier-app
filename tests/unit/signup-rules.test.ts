import { describe, expect, it } from "vitest";

import { HEARD_FROM } from "@/content/sign-up";
import { LocalStore } from "@/data/store";
import { AlreadySavedError, firstMissingStep, signAndSave } from "@/rules/booking";
import { codeMatches, emailProblem, emptyDraft, phoneProblem, signUpSteps, stepHref } from "@/rules/sign-up";
import { applySampleFill } from "@/sandbox/sample-fill";
import { SAMPLE_CODE } from "@/sandbox/sample-code";
import { buildSeed } from "@/sandbox/seed";
import { ageInMonths, firstLessonDate } from "@/rules/dates";
import { draftBirthDate } from "@/rules/sign-up";

import { completeDraft, memoryStorage, NOW, testId, TODAY } from "./helpers";

describe("sign-up", () => {
  it("steps counted for this family only", () => {
    expect(signUpSteps(null, true)).toHaveLength(9);
    const one = completeDraft({});
    const steps = signUpSteps(one, true);
    expect(steps.map((s) => s.key)).toEqual(["pool", "swimmers", "stage", "times", "you", "people", "who-stays", "payment", "release"]);
    expect(steps[2].href).toBe("/sign-up/stage?child=1");
    const two = completeDraft({
      kids: [
        { firstName: "Mia", birth: "2022-07-30", stage: "shallows", booking: { kind: "class", timeId: "mad-sun-1000-shallows" } },
        { firstName: "Leo", birth: "2023-05-01", stage: "pier", booking: { kind: "class", timeId: "mad-sun-0930-pier" } },
      ],
    });
    expect(signUpSteps(two, true)).toHaveLength(11);
    expect(signUpSteps(two, true).map((s) => s.href).slice(2, 6)).toEqual([
      "/sign-up/stage?child=1",
      "/sign-up/stage?child=2",
      "/sign-up/times?child=1",
      "/sign-up/times?child=2",
    ]);
    const waitlistOnly = completeDraft({ kids: [{ firstName: "Bo", birth: "2021-01-01", stage: "shallows", booking: null, waitlist: ["mad-wed-1630-shallows"] }] });
    expect(signUpSteps(waitlistOnly, true).map((s) => s.key)).not.toContain("payment");
    const evalOnly = completeDraft({ kids: [{ firstName: "Ivy", birth: "2022-01-01", stage: "evaluation", booking: { kind: "evaluation", timeId: "mad-eval-sun-1100" } }] });
    expect(signUpSteps(evalOnly, true)).toHaveLength(9);
    expect(signUpSteps(evalOnly, false)).toHaveLength(8);
    expect(stepHref("you")).toBe("/sign-up/you");
  });

  it("emails end in @example.com and phones use 555", () => {
    expect(emailProblem("jordan.sample@example.com")).toBeNull();
    expect(emailProblem("someone@gmail.com")).toMatch(/@example\.com/);
    expect(emailProblem("")).toMatch(/type an email/);
    expect(phoneProblem("404-555-0123")).toBeNull();
    expect(phoneProblem("(404) 555 0123")).toBeNull();
    expect(phoneProblem("4045550123")).toBeNull();
    expect(phoneProblem("404-123-4567")).toMatch(/555/);
    expect(phoneProblem("555-0123")).toMatch(/555/);
  });

  it("the sample code is 246810 and a wrong code doesn't match", () => {
    expect(SAMPLE_CODE).toBe("246810");
    expect(codeMatches("246810", SAMPLE_CODE)).toBe(true);
    expect(codeMatches("123456", SAMPLE_CODE)).toBe(false);
  });

  it("how did you hear about us is required with eight choices", () => {
    expect(HEARD_FROM.map((h) => h.label)).toEqual([
      "A card at the front desk",
      "A neighborhood app or site",
      "An online parent group",
      "My child's school or preschool",
      "An online listing",
      "A friend, neighbor or family member",
      "A web search",
      "Other",
    ]);
    const data = buildSeed();
    const draft = { ...completeDraft({}), heardFrom: null };
    expect(firstMissingStep(data, draft)).toMatchObject({ step: "you" });
    expect(firstMissingStep(data, completeDraft({}))).toBeNull();
  });

  it("the draft keeps every answer and the last step", async () => {
    const storage = memoryStorage();
    const store = new LocalStore({ seedVersion: "t", seed: buildSeed, storage });
    const draft = { ...completeDraft({}), lastPath: "/sign-up/times?child=1" };
    await store.transaction((tx) => tx.add("signUpDrafts", draft));
    // Close the tab and come back: a new store on the same phone storage.
    const later = new LocalStore({ seedVersion: "t", seed: buildSeed, storage });
    const kept = await later.get("signUpDrafts", draft.id);
    expect(kept).toEqual(draft);
    expect(kept!.lastPath).toBe("/sign-up/times?child=1");
  });

  it("sign and save books once, drops spots and clears the draft", async () => {
    const store = new LocalStore({ seedVersion: "t", seed: buildSeed, storage: memoryStorage() });
    const draft = completeDraft({});
    await store.transaction((tx) => tx.add("signUpDrafts", draft));
    const spots = (await store.get("classes", "mad-sun-1000-shallows"))!.openSpots;
    await store.transaction((tx) => signAndSave(tx, { draft, today: TODAY, now: NOW, browserName: "Chrome", newId: testId }));
    expect((await store.get("classes", "mad-sun-1000-shallows"))!.openSpots).toBe(spots - 1);
    expect(await store.get("signUpDrafts", draft.id)).toBeUndefined();
    const families = (await store.list("families")).length;
    // A second tap, or a refresh replaying the same draft, books nothing.
    await expect(store.transaction((tx) => signAndSave(tx, { draft, today: TODAY, now: NOW, browserName: "Chrome", newId: testId }))).rejects.toThrow(AlreadySavedError);
    expect((await store.list("families")).length).toBe(families);
    expect((await store.get("classes", "mad-sun-1000-shallows"))!.openSpots).toBe(spots - 1);
  });

  it("sample fill fills typed fields only", () => {
    const filled = applySampleFill(null, TODAY, NOW, () => "kid-1", "sign-up:this-phone");
    expect(filled.children).toHaveLength(1);
    expect(filled.children[0].firstName).toBe("Mia");
    const birth = draftBirthDate(filled.children[0])!;
    expect(Math.floor(ageInMonths(birth, firstLessonDate(0, TODAY, null)) / 12)).toBe(4);
    expect(filled.fullName).not.toBe("");
    expect(filled.email).toMatch(/@example\.com$/);
    expect(phoneProblem(filled.phone)).toBeNull();
    expect(filled.code).toBe(SAMPLE_CODE);
    expect(filled.contacts.every((c) => c.name && !phoneProblem(c.phone))).toBe(true);
    expect(filled.release.typedName).toBe(filled.fullName);
    // Every choice is still a tap.
    const blank = emptyDraft("sign-up:this-phone", NOW);
    expect(filled.poolId).toBe(blank.poolId);
    expect(filled.children[0].stage).toBeNull();
    expect(filled.children[0].booking).toBeNull();
    expect(filled.heardFrom).toBeNull();
    expect(filled.confirmedEmail).toBeNull();
    expect(filled.payment).toEqual(blank.payment);
    expect(filled.release.groups).toEqual({});
    expect(filled.release.agreeElectronic).toBe(false);
    expect(filled.listedAdults).toEqual([]);
    expect(filled.justMe).toBe(false);
  });
});
