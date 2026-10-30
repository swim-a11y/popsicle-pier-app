import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildSeed } from "@/sandbox/seed";

/*
  Family words: every screen a parent sees. The staff page and the owner's
  release versions are staff-facing and checked against their own rules.
*/
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const STAFF_FACING = ["src/components/screens/staff.tsx", "src/components/screens/owner-releases.tsx"];
export const FAMILY_FILES = [
  ...walk("src/content"),
  ...walk("src/components/screens"),
  ...walk("src/components/shell"),
  ...walk("src/components/parts"),
  "src/sandbox/coach-lines.ts",
  "src/sandbox/sandbox-pill.tsx",
  "src/screens.ts",
  "src/app/not-found.tsx",
  "src/rules/family.ts",
  "src/rules/sign-up.ts",
  "src/rules/booking.ts",
  "src/rules/first-sunday.ts",
  "src/rules/add.ts",
].filter((f) => /\.tsx?$/.test(f) && !STAFF_FACING.includes(f));

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

/** String literals and JSX text: what can reach a screen. */
export function visibleStrings(code: string): string[] {
  const src = stripComments(code);
  const out: string[] = [];
  for (const m of src.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)) out.push(m[1] ?? m[2] ?? m[3] ?? "");
  for (const m of src.matchAll(/>([^<>{}]+)</g)) out.push(m[1]);
  return out.map((s) => s.trim()).filter((s) => /[a-z]{2}/i.test(s));
}

export const BANNED: [RegExp, string][] = [
  [/\bsafe(?:r|st)?\b|water-safe/i, "safe words"],
  [/drown-?proof/i, "drown-proof"],
  [/\bproven\b/i, "proven"],
  [/\bguarantee/i, "guarantee"],
  [/\btest(?:s|ed|ing)?\b/i, "test"],
  [/\bmake-?ups?\b|\bmade up\b/i, "make-ups"],
  [/\bprizes?\b/i, "prizes"],
  [/\bshy\b|\bfearful\b|\bbehind\b|\ba natural\b|\bbrave\b/i, "a label on a child"],
  [/[–—]/, "an en or em dash"],
  [/[←-⇿⟵-⟿]|->|<-/, "an arrow"],
  [/\bsurcharge\b|\bfees?\b/i, "fee wording (cardPricing is card price)"],
  [/\bPP\b|PP\d{2}-\d{4}/, "PP or a child ID"],
  [/Jackrabbit|TeamUnify|Captyn|\bCommit\b/i, "another company name"],
  [/patient|pediatric|doctor|clinic|hospital|medical care/i, "medical care"],
];

describe("family words", () => {
  it("no banned words, dashes or arrows in family text", () => {
    const problems: string[] = [];
    for (const f of FAMILY_FILES) {
      for (const s of visibleStrings(readFileSync(f, "utf8"))) {
        for (const [re, why] of BANNED) if (re.test(s)) problems.push(`${f}: ${why}: ${s.slice(0, 80)}`);
        if (/drop-off/i.test(s) && !/no drop-off/i.test(s)) problems.push(`${f}: drop-off offered: ${s}`);
        if (/toilet/i.test(s) && !/wears a snug reusable swim diaper/.test(s)) problems.push(`${f}: toilet question: ${s}`);
      }
    }
    // The seeds' family-facing words: each pool's first-lesson notes and school email.
    // Closed days' reasons show on Lesson dates.
    for (const c of buildSeed().closures) for (const [re, why] of BANNED) if (re.test(c.reason)) problems.push(`closure ${c.id}: ${why}`);
    for (const pool of buildSeed().pools) {
      for (const s of [pool.name, pool.schoolEmail, ...Object.values(pool.firstLesson).flat()]) {
        for (const [re, why] of BANNED) if (re.test(s)) problems.push(`seed ${pool.name}: ${why}: ${s}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("research named only in the release research choice", () => {
    const problems: string[] = [];
    for (const f of FAMILY_FILES) {
      for (const s of visibleStrings(readFileSync(f, "utf8"))) {
        if (!/research/i.test(s)) continue;
        const allowed = f === "src/content/release.ts" && (s === "research" || s === "Research");
        const key = s === "research";
        if (!allowed && !key) problems.push(`${f}: ${s}`);
      }
    }
    expect(problems).toEqual([]);
    const release = readFileSync("src/content/release.ts", "utf8");
    expect(release).toContain('title: "Research"');
    expect(release).toContain("An observational study of how children's courage grows in lessons.");
  });
});
