import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const source = walk("src").filter((f) => /\.(tsx?|css)$/.test(f));
const read = (f: string) => readFileSync(f, "utf8");

describe("nothing leaves the device", () => {
  it("no api routes, server actions, middleware or proxy", () => {
    for (const f of walk("src/app")) expect(f).not.toMatch(/route\.(t|j)sx?$/);
    for (const f of ["middleware.ts", "src/middleware.ts", "proxy.ts", "src/proxy.ts"]) expect(existsSync(f), f).toBe(false);
    for (const f of source) expect(read(f), f).not.toMatch(/["']use server["']/);
  });

  it("no outside hosts, CDNs, analytics or next/font/google", () => {
    for (const f of source) {
      const text = read(f);
      expect(text, f).not.toMatch(/https?:\/\//);
      expect(text, f).not.toMatch(/next\/font|fonts\.googleapis|cdn\.|unpkg|jsdelivr/);
      expect(text, f).not.toMatch(/gtag\(|googletagmanager|google-analytics|@vercel\/analytics|plausible|mixpanel|hotjar|posthog|sentry/i);
      expect(text, f).not.toMatch(/<script\b|fetch\(|XMLHttpRequest|navigator\.sendBeacon|WebSocket\(/);
    }
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain('import "@fontsource/questrial/400.css"');
    expect(layout).toContain('import "@fontsource/work-sans/400.css"');
    expect(layout).toContain('import "@fontsource/work-sans/600.css"');
  });

  it("no mailto, sms, tel or share links, no camera or contact picker", () => {
    for (const f of source) {
      const text = read(f);
      expect(text, f).not.toMatch(/mailto:|sms:|tel:|navigator\.share|getUserMedia|navigator\.contacts|type="file"|capture=|<video|<img\b|<Image\b/);
    }
  });

  it("telemetry is off", () => {
    expect(read("next.config.ts")).toMatch(/process\.env\.NEXT_TELEMETRY_DISABLED = "1";/);
    expect(read("next.config.ts")).toContain("cacheComponents: false");
    expect(read("next.config.ts")).not.toContain("partialPrefetching");
  });

  it("sandbox pieces live in src/sandbox behind one switch", () => {
    expect(read("src/sandbox/index.ts")).toMatch(/export const SANDBOX = true;/);
    for (const f of ["seed.ts", "sample-fill.ts", "sample-code.ts", "actions.ts", "pretend-first-lesson.ts", "sandbox-pill.tsx"]) {
      expect(existsSync(join("src/sandbox", f)), f).toBe(true);
    }
    const actions = read("src/sandbox/actions.ts");
    for (const fn of ["playAs", "fillSampleFamily", "pretendTheFirstLesson", "eraseAllSampleData"]) expect(actions).toContain(`export async function ${fn}`);
    // The sample code and the seeds are only written in the sandbox folder.
    for (const f of source.filter((f) => !f.startsWith("src/sandbox/"))) {
      expect(read(f), f).not.toContain("246810");
      expect(read(f), f).not.toMatch(/buildSeed\(/);
    }
  });
});
