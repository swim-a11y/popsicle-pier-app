import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { SCREENS } from "@/screens";

function dirs(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? [p, ...dirs(p)] : [];
  });
}

describe("screens", () => {
  it("every screen in the config has a static page file", () => {
    const ids = new Set<string>();
    for (const s of SCREENS) {
      expect(ids.has(s.id), s.id).toBe(false);
      ids.add(s.id);
      const file = join("src/app", s.path, "page.tsx");
      expect(existsSync(file), file).toBe(true);
      expect(readFileSync(file, "utf8")).toContain(`screenMetadata("${s.id}")`);
    }
    const pages = dirs("src/app").filter((d) => existsSync(join(d, "page.tsx"))).length + (existsSync("src/app/page.tsx") ? 1 : 0);
    expect(pages).toBe(SCREENS.length);
  });

  it("no dynamic route segments", () => {
    for (const d of dirs("src/app")) expect(d).not.toMatch(/\[|\(\.|@/);
    for (const s of SCREENS) expect(s.path).toMatch(/^\/[a-z/-]*$/);
  });

  it("layout sets noindex and the sample app title", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).toContain('template: "%s, Popsicle Pier sample app"');
    expect(layout).toContain('default: "Popsicle Pier sample app"');
    expect(layout).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false/);
    expect(layout).toContain("<SampleBanner />");
  });

  it("robots.txt disallows all", () => {
    expect(readFileSync("public/robots.txt", "utf8").trim()).toBe("User-agent: *\nDisallow: /");
  });
});
