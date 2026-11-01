/*
  Checks the one-file preview at phone size, straight from its file: walk-through 1's
  sign-up, Your first lesson, Bills, the owner's inbox and a reload, with no script
  errors and no request leaving the page. Screenshots land in preview/dist/.
  Run after `node preview/build.mjs`: node preview/check.mjs
*/
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

const OUT = path.resolve("preview", "dist");
const FILE = pathToFileURL(path.join(OUT, "popsicle-pier-sample.html")).href;
await (async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.clock.setSystemTime(new Date("2026-10-30T15:00:00Z"));
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  const requests = [];
  page.on("request", (r) => { if (!r.url().startsWith("file:") && !r.url().startsWith("data:")) requests.push(r.url()); });
  const tap = (l) => l.click();
  await page.goto(`${FILE}#/sign-up`);
  await page.getByText("Sample app. Made-up families, classes and prices.").first().waitFor();
  console.log("title:", await page.title());
  await page.screenshot({ path: `${OUT}/01-start.png` });
  await tap(page.getByRole("button", { name: /Sandbox/ }));
  await tap(page.getByRole("button", { name: "Fill in a sample family" }));
  await tap(page.getByRole("button", { name: /^Madison/ }));
  await tap(page.getByRole("button", { name: "Continue" }));
  await tap(page.getByRole("button", { name: /^The Shallows/ }));
  await page.getByTestId("time-mad-sun-1000-shallows").waitFor();
  await page.screenshot({ path: `${OUT}/02-times.png` });
  await tap(page.getByTestId("time-mad-sun-1000-shallows"));
  await tap(page.getByRole("button", { name: "Send my code" }));
  await page.getByText("Email confirmed").waitFor();
  await tap(page.getByRole("button", { name: "A friend, neighbor or family member" }));
  await tap(page.getByRole("button", { name: "Skip and continue" }));
  await tap(page.getByRole("button", { name: "Just me for now" }));
  await tap(page.getByRole("button", { name: /^Bank draft/ }));
  await tap(page.getByLabel("I authorize these bank drafts"));
  await tap(page.getByRole("button", { name: "Add a backup card (sample)" }));
  await tap(page.getByRole("button", { name: "Continue" }));
  for (const key of ["staying", "recording", "ai-review", "who-can-watch", "keeping", "other-families", "signing", "claims"]) await tap(page.locator(`#box-${key}`));
  await tap(page.getByRole("radio", { name: "No" }).first());
  await tap(page.getByRole("radio", { name: "No" }).nth(1));
  await page.getByLabel("Your full name").fill("Jordan Sample");
  await tap(page.getByLabel("I agree to this release and to signing it electronically"));
  await tap(page.getByRole("button", { name: "Sign and save my spot" }));
  await page.getByRole("heading", { name: "You're in" }).waitFor();
  console.log("after sign-up:", await page.evaluate(() => document.documentElement.dataset.previewScreen), "|", await page.title());
  await page.screenshot({ path: `${OUT}/03-youre-in.png` });
  await tap(page.getByRole("button", { name: "See your first lesson" }));
  await page.getByText("The lesson runs 27 minutes.").first().waitFor();
  console.log("first lesson:", await page.evaluate(() => document.documentElement.dataset.previewScreen));
  // Tab bar links and the back button.
  await tap(page.getByRole("navigation", { name: "Family tabs" }).getByRole("link", { name: "More" }));
  await tap(page.getByRole("link", { name: /^Bills/ }));
  await page.getByTestId("month-bill").first().waitFor();
  console.log("bills:", await page.evaluate(() => document.documentElement.dataset.previewScreen));
  await tap(page.getByRole("navigation", { name: "Family tabs" }).getByRole("link", { name: "More" }));
  await page.getByRole("link", { name: /^Bills/ }).waitFor();
  console.log("back to:", await page.evaluate(() => document.documentElement.dataset.previewScreen));
  // The owner's inbox from the Sandbox sheet.
  await tap(page.getByRole("button", { name: /Sandbox/ }));
  await tap(page.getByRole("button", { name: /^Owner/ }));
  await page.getByRole("heading", { name: "Inbox", level: 1 }).waitFor();
  console.log("owner:", await page.evaluate(() => document.documentElement.dataset.previewScreen));
  await page.screenshot({ path: `${OUT}/04-inbox.png` });
  // A reload keeps the family (localStorage) and the screen (the address after #).
  await page.reload();
  await page.getByRole("heading", { name: "Inbox", level: 1 }).waitFor();
  console.log("after reload:", await page.evaluate(() => document.documentElement.dataset.previewScreen));
  console.log("errors:", errors.length ? errors : "none");
  console.log("outside requests:", requests.length ? requests : "none");
  await browser.close();
  if (errors.length || requests.length) process.exit(1);
})().catch((e) => {
  console.error("FAILED:", e.message.split("\n")[0]);
  process.exit(1);
});
