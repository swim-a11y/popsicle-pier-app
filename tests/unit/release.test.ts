import { describe, expect, it } from "vitest";

import {
  AGREE_ELECTRONIC,
  MARKETING_EMAILS_CONSENT,
  NEWSLETTER_CONSENT,
  RELEASE_V2,
  SIGN_BUTTON,
  TEXTS_CONSENT,
} from "@/content/release";
import { LocalStore } from "@/data/store";
import type { ReleaseVersion } from "@/data/types";
import { sha256Hex } from "@/lib/sha256";
import { recordSignature, releaseProblem, signAndSave } from "@/rules/booking";
import {
  addChildCoverage,
  buildReleaseView,
  currentRelease,
  EIGHT_GROUPS,
  familyNeedsToSign,
  latestSignature,
  missingGroups,
  NeedsCurrentReleaseError,
  releaseFingerprint,
  releaseTemplateText,
  releaseViewText,
} from "@/rules/release";
import { emptyDraft } from "@/rules/sign-up";
import { buildSeed, PUBLISHED_FINGERPRINTS } from "@/sandbox/seed";

import { completeDraft, memoryStorage, NOW, testId, TODAY } from "./helpers";

const data = buildSeed();

describe("release", () => {
  it("each version's text matches its fingerprint", () => {
    expect(data.releaseVersions).toHaveLength(2);
    for (const v of data.releaseVersions) {
      expect(v.fingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(releaseFingerprint(v)).toBe(v.fingerprint);
      expect(sha256Hex(releaseTemplateText(v))).toBe(PUBLISHED_FINGERPRINTS[v.id as "v1" | "v2"]);
    }
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    // Changing one published word breaks the match.
    const v2 = data.releaseVersions.find((v) => v.id === "v2")!;
    const edited: ReleaseVersion = { ...v2, groups: v2.groups.map((g, i) => (i === 0 ? { ...g, lines: [...g.lines, "One more line."] } : g)) };
    expect(releaseFingerprint(edited)).not.toBe(v2.fingerprint);
  });

  it("the current version holds all eight groups", () => {
    const current = currentRelease(data);
    expect(current.id).toBe("v2");
    expect(missingGroups(current)).toEqual([]);
    expect(current.groups.map((g) => g.title)).toEqual(EIGHT_GROUPS.map((g) => g.title));
    for (const g of current.groups) {
      expect(g.lines.length).toBeGreaterThan(0);
      expect(g.box.length).toBeGreaterThan(0);
    }
    const text = releaseTemplateText(current);
    for (const g of EIGHT_GROUPS) expect(text).toContain(g.title);
    // The check notices a missing group.
    expect(missingGroups({ ...current, groups: current.groups.filter((g) => g.key !== "ai-review") })).toEqual(["AI review and our tools"]);
    expect(missingGroups(data.releaseVersions.find((v) => v.id === "v1")!)).toEqual(["AI review and our tools"]);
  });

  it("v1 and v2 each have What changed lines and v2 is current", () => {
    expect(data.releaseVersions.filter((v) => v.isCurrent).map((v) => v.id)).toEqual(["v2"]);
    for (const v of data.releaseVersions) {
      expect(v.whatChanged.length).toBeGreaterThanOrEqual(2);
      expect(v.whatChanged.length).toBeLessThanOrEqual(3);
    }
    expect(data.releaseVersions.find((v) => v.id === "v1")!.publishedOn < data.releaseVersions.find((v) => v.id === "v2")!.publishedOn).toBe(true);
  });

  it("the text shown names every child and hashes with SHA-256", () => {
    const view = buildReleaseView(
      currentRelease(data),
      [
        { key: "a", firstName: "Mia" },
        { key: "b", firstName: "Leo" },
      ],
      "buckhead.sample@example.com",
    );
    const text = releaseViewText(view);
    expect(view.covers).toBe("Covers Mia and Leo");
    expect(text).toContain("SAMPLE release");
    expect(text).toContain("Is there a court order, custody arrangement or foster placement that limits recording or who may bring Mia?");
    expect(text).toContain("Is there anything about Leo's health we should know before the first lesson?");
    expect(text).toContain("Yes, Leo can be part of the study.");
    // Where it says to email us, the pool's email shows as plain text.
    expect(text).toContain("You can withdraw anytime by emailing us at buckhead.sample@example.com.");
    expect(text).not.toContain("[email]");
    expect(sha256Hex(text)).toMatch(/^[0-9a-f]{64}$/);
    // Every line of every group is in the text: nothing folded away.
    for (const g of view.groups) for (const line of g.lines) expect(text).toContain(line);
  });

  it("every group box is required and the three choices start unchecked", () => {
    const current = currentRelease(data);
    const answers = { a: { custody: "no" as const, health: "no" as const, research: false, marketing: false, underwater: false } };
    const all = { groups: Object.fromEntries(EIGHT_GROUPS.map((g) => [g.key, true])), perChild: answers, texts: false, newsletter: false, marketingEmails: false, typedName: "Jordan Sample", agreeElectronic: true };
    expect(releaseProblem(current, all, ["a"])).toBeNull();
    for (const g of EIGHT_GROUPS) {
      const missingOne = { ...all, groups: { ...all.groups, [g.key]: false } };
      expect(releaseProblem(current, missingOne, ["a"])).toContain(g.title);
    }
    expect(releaseProblem(current, { ...all, perChild: { a: { ...answers.a, health: null } } }, ["a"])).toMatch(/yes or no/);
    expect(releaseProblem(current, { ...all, typedName: " " }, ["a"])).toMatch(/full name/);
    expect(releaseProblem(current, { ...all, agreeElectronic: false }, ["a"])).toMatch(/electronically/);
    const fresh = emptyDraft("d", NOW).release;
    expect(fresh.perChild).toEqual({});
    expect(current.choices.map((c) => c.key)).toEqual(["research", "marketing", "underwater"]);
    expect(RELEASE_V2.choices).toHaveLength(3);
    expect(SIGN_BUTTON).toBe("Sign and save my spot");
    expect(AGREE_ELECTRONIC).toBe("I agree to this release and to signing it electronically");
  });

  it("texts, newsletter and marketing email boxes are separate and unchecked", () => {
    const fresh = emptyDraft("d", NOW).release;
    expect(fresh.texts).toBe(false);
    expect(fresh.newsletter).toBe(false);
    expect(fresh.marketingEmails).toBe(false);
    expect(TEXTS_CONSENT).toBe(
      "Text me about lesson cancellations and schedule changes. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of enrollment.",
    );
    expect(NEWSLETTER_CONSENT).toMatch(/newsletter/);
    expect(MARKETING_EMAILS_CONSENT).toMatch(/marketing emails/);
    // They're not part of the release text itself.
    const text = releaseTemplateText(currentRelease(data));
    expect(text).not.toContain(TEXTS_CONSENT);
  });

  it("a family on an older version signs the current version once for everyone", async () => {
    const store = new LocalStore({ seedVersion: "t", seed: buildSeed, storage: memoryStorage() });
    const before = await store.snapshot();
    expect(latestSignature(before, "family-marlow")!.versionId).toBe("v1");
    expect(familyNeedsToSign(before, "family-marlow")).toBe(true);
    await expect(store.transaction((tx) => addChildCoverage(tx, { familyId: "family-marlow", childRecordId: "child-ari", at: NOW, id: "cov" }))).rejects.toThrow(
      NeedsCurrentReleaseError,
    );
    const draft = completeDraft({});
    await store.transaction((tx) => {
      const kids = tx.list("children").filter((c) => c.familyId === "family-marlow");
      recordSignature(tx, {
        familyId: "family-marlow",
        version: currentRelease(tx.data()),
        children: kids.map((c) => ({ key: c.id, child: c, answers: { custody: "no", health: "no", research: false, marketing: false, underwater: false } })),
        release: { ...draft.release, typedName: "Lee Marlow" },
        confirmedEmail: "lee.marlow@example.com",
        schoolEmail: "madison.sample@example.com",
        browserName: "Chrome",
        now: NOW,
        newId: testId,
      });
    });
    const after = await store.snapshot();
    expect(familyNeedsToSign(after, "family-marlow")).toBe(false);
    const latest = latestSignature(after, "family-marlow")!;
    expect(latest.versionId).toBe("v2");
    expect(latest.children.map((c) => c.firstName)).toEqual(["Ari"]);
    // The old signature is still there, untouched.
    expect(after.releaseSignatures.find((s) => s.id === "signature-marlow-v1")).toEqual(before.releaseSignatures.find((s) => s.id === "signature-marlow-v1"));
  });

  it("a family on the current version adding a child gets a coverage row, never an edit", async () => {
    const store = new LocalStore({ seedVersion: "t", seed: buildSeed, storage: memoryStorage() });
    const draft = completeDraft({});
    await store.transaction((tx) => tx.add("signUpDrafts", draft));
    const { familyId } = await store.transaction((tx) => signAndSave(tx, { draft, today: TODAY, now: NOW, browserName: "Chrome", newId: testId }));
    const before = await store.snapshot();
    const signature = latestSignature(before, familyId)!;
    const coverage = await store.transaction((tx) => {
      const child = tx.add("children", { id: "new-kid", familyId, firstName: "Ola", birthDate: "2023-01-01", childId: null, stageId: "pier", flaggedForPerson: false, createdAt: NOW });
      return addChildCoverage(tx, { familyId, childRecordId: child.id, at: NOW, id: "cov-1" });
    });
    const after = await store.snapshot();
    expect(coverage!.signatureId).toBe(signature.id);
    // Adding the same child again, or a child the signature already names, adds nothing.
    const again = await store.transaction((tx) => addChildCoverage(tx, { familyId, childRecordId: "new-kid", at: NOW, id: "cov-2" }));
    expect(again!.id).toBe("cov-1");
    const named = await store.transaction((tx) => addChildCoverage(tx, { familyId, childRecordId: signature.children[0].childRecordId, at: NOW, id: "cov-3" }));
    expect(named).toBeNull();
    expect((await store.snapshot()).coverages).toHaveLength(1);
    expect(after.coverages).toHaveLength(1);
    expect(after.releaseSignatures.filter((s) => s.familyId === familyId)).toHaveLength(1);
    expect(after.releaseSignatures.find((s) => s.id === signature.id)).toEqual(signature);
    expect(familyNeedsToSign(after, familyId)).toBe(false);
  });
});
