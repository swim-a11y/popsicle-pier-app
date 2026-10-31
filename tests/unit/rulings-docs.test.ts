import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("the owner's rulings are written down", () => {
  it("ruling 6 is in CLAUDE.md with the owner's own words, and its decisions are in DECISIONS.md", () => {
    const claude = readFileSync("CLAUDE.md", "utf8");
    expect(claude).toContain("6. **No partner after the first month: the drafted notice.**");
    expect(claude).toContain('"drafted notice when a semiprivate has no partner" (October 31, 2026)');
    const decisions = readFileSync("DECISIONS.md", "utf8");
    expect(decisions).toContain("## No partner after the first month (owner ruling 6, October 31, 2026)");
    for (const n of [143, 144, 145, 146, 147]) expect(decisions).toMatch(new RegExp(`^${n}\\. \\*\\*`, "m"));
  });
});
