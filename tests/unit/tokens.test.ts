import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const tokens = readFileSync("src/styles/tokens.css", "utf8");
const globals = readFileSync("src/app/globals.css", "utf8");

function color(name: string): string {
  const m = tokens.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`No color token ${name}`);
  return m[1];
}

function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = ch.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("tokens", () => {
  it("every value is a named token", () => {
    for (const name of ["top-bar", "on-top-bar", "heading", "text", "page", "surface", "action", "on-action", "mark", "on-mark", "highlight", "on-highlight", "notice", "success", "line", "focus"]) {
      expect(color(name)).toMatch(/^#/);
    }
    expect(color("top-bar").toLowerCase()).toBe("#163a5c");
    expect(color("action").toLowerCase()).toBe("#275681");
    expect(color("mark").toLowerCase()).toBe("#00a8a0");
    expect(color("highlight").toLowerCase()).toBe("#f2b300");
    expect(color("page").toLowerCase()).toBe("#f7f6ef");
    expect(color("surface").toLowerCase()).toBe("#ffffff");
    expect(color("text").toLowerCase()).toBe("#152b44");
    expect(color("notice").toLowerCase()).toBe("#fcefc7");
    expect(color("success").toLowerCase()).toBe("#dcf1ef");
    expect(color("focus").toLowerCase()).toBe("#163a5c");
    expect(tokens).toMatch(/--font-heading:\s*"Questrial", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif/);
    expect(tokens).toMatch(/--font-text:\s*"Work Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif/);
    // Tailwind's own palette, fonts, sizes, radii and shadows are cleared so only these names exist.
    for (const cleared of ["--color-*: initial", "--font-*: initial", "--text-*: initial", "--radius-*: initial", "--shadow-*: initial"]) {
      expect(tokens).toContain(cleared);
    }
  });

  it("no raw color or font outside tokens.css", () => {
    const files = walk("src").filter((f) => /\.(tsx?|css)$/.test(f) && !f.endsWith("styles/tokens.css"));
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      expect(text, f).not.toMatch(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b(?![0-9a-zA-Z-])/);
      expect(text, f).not.toMatch(/\b(?:rgb|rgba|hsl|hsla|oklch)\(/);
      expect(text, f).not.toMatch(/font-family\s*:(?!\s*var\()/);
      expect(text, f).not.toMatch(/\b(?:text|bg|border|ring|fill|stroke)-(?:white|black|zinc|gray|slate|neutral|stone|red|blue|green|amber|yellow|teal|sky)\b/);
      expect(text, f).not.toMatch(/next\/font|Geist/);
    }
  });

  it("shadcn variables point at tokens", () => {
    const root = globals.slice(globals.indexOf(":root"), globals.indexOf("}", globals.indexOf(":root")));
    for (const v of ["--background", "--foreground", "--primary", "--primary-foreground", "--muted", "--border", "--ring", "--radius", "--card", "--accent", "--destructive", "--input"]) {
      expect(root).toMatch(new RegExp(`${v}:\\s*var\\(--(?:color|radius)-[a-z-]+\\);`));
    }
    expect(globals).not.toMatch(/\.dark\b|@custom-variant dark|prefers-color-scheme:\s*dark/);
  });

  it("contrast: text 4.5:1, lines and focus 3:1", () => {
    const text: [string, string][] = [
      ["text", "page"],
      ["text", "surface"],
      ["text", "notice"],
      ["text", "success"],
      ["heading", "page"],
      ["heading", "surface"],
      ["heading", "success"],
      ["action", "page"],
      ["action", "surface"],
      ["on-action", "action"],
      ["on-top-bar", "top-bar"],
      ["on-mark", "mark"],
      ["on-highlight", "highlight"],
    ];
    for (const [fg, bg] of text) expect(contrast(color(fg), color(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    const lines: [string, string][] = [
      ["line", "page"],
      ["line", "surface"],
      ["line", "success"],
      ["line", "notice"],
      ["focus", "page"],
      ["focus", "surface"],
      ["focus", "success"],
      ["focus", "notice"],
    ];
    for (const [fg, bg] of lines) expect(contrast(color(fg), color(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(3);
  });
});
