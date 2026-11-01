/*
  The one-file preview: the whole sample app in one page, so the owner can open it
  on a phone from a private link, with no server and nothing to install.
  preview/dist/popsicle-pier-sample.html opens straight from a computer's files;
  preview/dist/popsicle-pier-sample.artifact.html is the same page without the
  document tags, for publishing as a private claude.ai artifact, whose host adds them. It runs `next build` for the compiled stylesheet, bundles every screen
  with esbuild (next/navigation, next/link and src/lib/nav.ts swapped for the
  in-memory versions in this folder), and puts the script, the stylesheet and the
  fonts inside the page. Data stays in that browser's localStorage, as in the app.

  Run: node preview/build.mjs   (add --skip-next to reuse the last `next build`)
*/
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { build } from "esbuild";

const root = process.cwd();
const here = path.join(root, "preview");
const work = path.join(here, ".build");
const out = path.join(here, "dist", "popsicle-pier-sample.html");
const outArtifact = path.join(here, "dist", "popsicle-pier-sample.artifact.html");

// 1. The compiled stylesheet and its fonts, from Next's own build.
if (!process.argv.includes("--skip-next")) execSync("npx next build", { stdio: "inherit" });
const chunks = path.join(root, ".next", "static", "chunks");
const media = path.join(root, ".next", "static", "media");
let css = fs
  .readdirSync(chunks)
  .filter((f) => f.endsWith(".css"))
  .sort()
  .map((f) => fs.readFileSync(path.join(chunks, f), "utf8"))
  .join("\n");
// Every phone browser reads woff2: keep those, inside the page.
css = css.replace(/,\s*url\(\.\.\/media\/[^)]+\.woff\)\s*format\("woff"\)/g, "");
css = css.replace(/url\(\.\.\/media\/([^)]+\.woff2)\)/g, (_, name) => `url(data:font/woff2;base64,${fs.readFileSync(path.join(media, name)).toString("base64")})`);
if (/url\(\.\.\//.test(css)) throw new Error("The stylesheet points at a file the preview doesn't hold.");

// 2. Every screen, by its path, from src/app's page files.
const pages = [];
(function walk(dir, route) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (/^[[(]/.test(entry.name)) throw new Error(`The preview has no way to show ${entry.name} yet.`);
      walk(path.join(dir, entry.name), `${route}/${entry.name}`);
    } else if (entry.name === "page.tsx") {
      pages.push({ route: route || "/", from: `@/app${route}/page` });
    }
  }
})(path.join(root, "src", "app"), "");
pages.sort((a, b) => a.route.localeCompare(b.route));

fs.mkdirSync(work, { recursive: true });
const entry = path.join(work, "entry.tsx");
fs.writeFileSync(
  entry,
  `// Written by preview/build.mjs. Each screen of src/app, by its path.
import { createRoot } from "react-dom/client";
import { useEffect, type ComponentType } from "react";

import NotFound from "@/app/not-found";
import { SampleBanner } from "@/components/shell/sample-banner";

import { usePathname } from "../next-navigation";
${pages.map((p, i) => `import * as P${i} from "${p.from}";`).join("\n")}

type PageModule = { default: ComponentType; metadata?: { title?: string } };
const ROUTES: Record<string, PageModule> = {
${pages.map((p, i) => `  ${JSON.stringify(p.route)}: P${i} as PageModule,`).join("\n")}
};

function App() {
  const path = usePathname();
  const page = ROUTES[path] ?? ROUTES[path.replace(/\\/+$/, "")];
  const title = page?.metadata?.title;
  useEffect(() => {
    document.title = title ? \`\${title}, Popsicle Pier sample app\` : "Popsicle Pier sample app";
  }, [title]);
  const Page = page?.default ?? NotFound;
  return (
    <>
      <SampleBanner />
      <Page key={path} />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
`,
);

// 3. One script: the app, React, and the stand-ins for Next's router.
const shims = {
  "next/navigation": path.join(here, "next-navigation.ts"),
  "next/link": path.join(here, "next-link.tsx"),
  "@/lib/nav": path.join(here, "nav.ts"),
};
const result = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  minify: true,
  jsx: "automatic",
  tsconfig: path.join(root, "tsconfig.json"),
  define: { "process.env.NODE_ENV": '"production"' },
  loader: { ".css": "empty" },
  legalComments: "none",
  logLevel: "error",
  plugins: [
    {
      name: "preview-stand-ins",
      setup(b) {
        b.onResolve({ filter: /^(next\/navigation|next\/link|@\/lib\/nav)$/ }, (args) => ({ path: shims[args.path] }));
      },
    },
  ],
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

// 4. The pages: the banner's own words stay on every screen; noindex, light only.
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="color-scheme" content="light">
<meta name="format-detection" content="telephone=no, email=no, address=no, date=no">
<title>Popsicle Pier sample app</title>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>
`;
// The artifact host adds the document tags and pads the page for a phone's notch and home bar:
// the banner sticks below the notch, a navy band fills the notch, and the tab bar sits above the home bar.
const phoneEdges = `header.sticky{top:env(safe-area-inset-top,0px)}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:41;background:var(--color-top-bar)}
nav.fixed.bottom-0{padding-bottom:env(safe-area-inset-bottom,0px)}`;
const artifact = `<title>Popsicle Pier sample app</title>
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="format-detection" content="telephone=no, email=no, address=no, date=no">
<style>${css}
${phoneEdges}</style>
<div id="root"></div>
<script>${js}</script>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
fs.writeFileSync(outArtifact, artifact);
console.log(`${path.relative(root, out)}: ${pages.length} screens, ${(html.length / 1024).toFixed(0)} KB (and the artifact copy)`);
