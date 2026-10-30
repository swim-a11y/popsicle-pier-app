/*
  The family release: what's shown, its exact text and fingerprints, and
  the data-layer rules for signing again and adding a child.
*/
import {
  CHOICES_INTRO,
  CUSTODY_QUESTION,
  HEALTH_QUESTION,
  RELEASE_SAMPLE_NOTE,
  RELEASE_TITLE,
} from "@/content/release";
import type { Transaction } from "@/data/store";
import type { AppData, Coverage, ReleaseChoiceText, ReleaseGroup, ReleaseGroupKey, ReleaseSignature, ReleaseVersion } from "@/data/types";
import { sha256Hex } from "@/lib/sha256";

export const EIGHT_GROUPS: readonly { key: ReleaseGroupKey; title: string }[] = [
  { key: "staying", title: "Staying at the pool" },
  { key: "recording", title: "Recording" },
  { key: "ai-review", title: "AI review and our tools" },
  { key: "who-can-watch", title: "Who can watch" },
  { key: "keeping", title: "Keeping and your family library" },
  { key: "other-families", title: "Other families" },
  { key: "signing", title: "Signing for my children" },
  { key: "claims", title: "Release of claims" },
];

export interface ReleaseChildRef {
  key: string;
  firstName: string;
}

export interface ReleaseViewGroup extends ReleaseGroup {
  questions: { childKey: string; firstName: string; custody: string; health: string }[];
}

export interface ReleaseView {
  versionId: string;
  title: string;
  sampleNote: string;
  covers: string;
  groups: ReleaseViewGroup[];
  choicesIntro: string;
  choices: { childKey: string; firstName: string; items: (ReleaseChoiceText & { boxText: string })[] }[];
}

/** "Mia", "Mia and Leo", "Mia, Leo and Ada" */
export function namesList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const fill = (text: string, name: string) => text.replaceAll("[name]", name);

export function buildReleaseView(version: ReleaseVersion, children: ReleaseChildRef[], coversOverride?: string): ReleaseView {
  return {
    versionId: version.id,
    title: RELEASE_TITLE,
    sampleNote: RELEASE_SAMPLE_NOTE,
    covers: coversOverride ?? `Covers ${namesList(children.map((c) => c.firstName))}`,
    groups: version.groups.map((g) => ({
      ...g,
      questions:
        g.key === "signing"
          ? children.map((c) => ({
              childKey: c.key,
              firstName: c.firstName,
              custody: fill(CUSTODY_QUESTION, c.firstName),
              health: fill(HEALTH_QUESTION, c.firstName),
            }))
          : [],
    })),
    choicesIntro: CHOICES_INTRO,
    choices: children.map((c) => ({
      childKey: c.key,
      firstName: c.firstName,
      items: version.choices.map((ch) => ({ ...ch, boxText: fill(ch.box, c.firstName) })),
    })),
  };
}

/** The exact text shown, in the order it's shown. This is what gets hashed. */
export function releaseViewText(view: ReleaseView): string {
  const out: string[] = [view.title, view.sampleNote, view.covers];
  for (const g of view.groups) {
    out.push(g.title, ...g.lines);
    for (const q of g.questions) out.push(q.custody, "Yes", "No", q.health, "Yes", "No");
    out.push(g.box);
  }
  out.push(view.choicesIntro);
  for (const c of view.choices) {
    out.push(c.firstName);
    for (const item of c.items) out.push(item.title, ...item.lines, item.boxText);
  }
  return out.join("\n");
}

/** A version's own text, with placeholders where names go. */
export function releaseTemplateText(version: ReleaseVersion): string {
  return releaseViewText(buildReleaseView(version, [{ key: "child", firstName: "[name]" }], "Covers [names]"));
}

export function releaseFingerprint(version: Pick<ReleaseVersion, "groups" | "choices" | "id">): string {
  return sha256Hex(releaseTemplateText(version as ReleaseVersion));
}

export function currentRelease(data: Readonly<AppData>): ReleaseVersion {
  const current = data.releaseVersions.find((v) => v.isCurrent);
  if (!current) throw new Error("No current release version.");
  return current;
}

export function missingGroups(version: ReleaseVersion): string[] {
  return EIGHT_GROUPS.filter((g) => !version.groups.some((vg) => vg.key === g.key && vg.title === g.title)).map((g) => g.title);
}

export function familySignatures(data: Readonly<AppData>, familyId: string): ReleaseSignature[] {
  return data.releaseSignatures.filter((s) => s.familyId === familyId).sort((a, b) => (a.signedAt < b.signedAt ? 1 : -1));
}

export function latestSignature(data: Readonly<AppData>, familyId: string): ReleaseSignature | undefined {
  return familySignatures(data, familyId)[0];
}

/** A family with no signature, or one on an older version, signs the current version once for everyone. */
export function familyNeedsToSign(data: Readonly<AppData>, familyId: string): boolean {
  const latest = latestSignature(data, familyId);
  return !latest || latest.versionId !== currentRelease(data).id;
}

/** Every child a signature covers: the ones it names plus coverage rows added later. */
export function coveredChildIds(data: Readonly<AppData>, signature: ReleaseSignature): string[] {
  const later = data.coverages.filter((c) => c.signatureId === signature.id).map((c) => c.childRecordId);
  return [...signature.children.map((c) => c.childRecordId), ...later];
}

export class NeedsCurrentReleaseError extends Error {
  constructor() {
    super("This family signed an older release. They sign the current version once for everyone first.");
    this.name = "NeedsCurrentReleaseError";
  }
}

/**
 * A family on the current version adding a child signs nothing: the child
 * gets a coverage row under that signature, never an edit to it.
 */
export function addChildCoverage(tx: Transaction, input: { familyId: string; childRecordId: string; at: string; id: string }): Coverage {
  const data = tx.data();
  const latest = latestSignature(data, input.familyId);
  if (!latest || latest.versionId !== currentRelease(data).id) throw new NeedsCurrentReleaseError();
  if (coveredChildIds(data, latest).includes(input.childRecordId)) {
    return data.coverages.find((c) => c.signatureId === latest.id && c.childRecordId === input.childRecordId) as Coverage;
  }
  return tx.add("coverages", {
    id: input.id,
    familyId: input.familyId,
    signatureId: latest.id,
    versionId: latest.versionId,
    childRecordId: input.childRecordId,
    addedAt: input.at,
  });
}
