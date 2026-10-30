import { test, expect, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";

/*
  The six walk-throughs, in order, as one serial group sharing one page, so
  walk-through 6 picks up the families from walk-throughs 1 and 2. Every tap
  and typed field is counted; each step saves a screenshot and runs axe and
  the family-words check. Counts go to docs/check-report.md.
*/

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

const STORAGE_KEY = "popsicle-pier-sample-app";
const REPORT = "docs/check-report.md";

interface StepCount {
  step: string;
  taps: number;
  typed: number;
}
interface Run {
  n: number;
  title: string;
  steps: StepCount[];
  passed: boolean;
  notes: string[];
}

const runs: Run[] = [];
let page: Page;
let run: Run | null = null;
let current: StepCount | null = null;
let shotIndex = 0;

const FAMILY_BANNED: [RegExp, string][] = [
  [/\bsafe(?:r|st)?\b|water-safe/i, "safe words"],
  [/drown-?proof|\bproven\b|\bguarantee/i, "promise words"],
  [/\btest(?:s|ed|ing)?\b/i, "test"],
  [/\bmake-?ups?\b|\bprizes?\b/i, "make-ups or prizes"],
  [/\bshy\b|\bfearful\b|\bbehind\b|\ba natural\b|\bbrave\b/i, "a label on a child"],
  [/[–—]/, "an en or em dash"],
  [/[←-⇿⟵-⟿]|->/, "an arrow"],
  [/\bsurcharge\b|\bfees?\b/i, "fee wording"],
  [/\bPP\b|PP\d{2}-\d{4}/, "PP or a child ID"],
  [/Jackrabbit|TeamUnify|Captyn/i, "another company name"],
];

function begin(n: number, title: string) {
  run = { n, title, steps: [], passed: false, notes: [] };
  runs.push(run);
  shotIndex = 0;
}

/** Starts counting a new screen. */
function screen(name: string) {
  current = { step: name, taps: 0, typed: 0 };
  run!.steps.push(current);
}

async function tap(locator: Locator) {
  await locator.click();
  current!.taps += 1;
}

async function type(locator: Locator, text: string) {
  await locator.fill(text);
  current!.typed += 1;
}

/** Screenshot, axe, and (for parent screens) the family-words check. */
async function check(name: string, opts: { family?: boolean } = { family: true }) {
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("skeleton")).toHaveCount(0);
  shotIndex += 1;
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `screenshots/walkthrough-${run!.n}-${String(shotIndex).padStart(2, "0")}-${name}.png`, fullPage: true });
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${name}: ${v.id}: ${v.help}`)).toEqual([]);
  if (opts.family !== false) {
    const text = await page.locator("main").innerText();
    for (const [re, why] of FAMILY_BANNED) expect(re.test(text), `${name} has ${why}: ${text.match(re)?.[0]}`).toBe(false);
    if (/drop-off/i.test(text)) expect(text).not.toMatch(/(?<!no )drop-off(?! )/i);
  }
}

async function stored() {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}").data, STORAGE_KEY);
}

async function openSandbox() {
  await tap(page.getByRole("button", { name: "Sandbox" }));
  await expect(page.getByRole("dialog")).toBeVisible();
}

function datePartsYearsAgo(years: number, extraMonths: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - (years * 12 + extraMonths));
  return { m: String(d.getMonth() + 1), d: String(d.getDate()), y: String(d.getFullYear()) };
}

async function checkReleaseBoxes() {
  for (const key of ["staying", "recording", "ai-review", "who-can-watch", "keeping", "other-families", "signing", "claims"]) {
    await tap(page.locator(`#box-${key}`));
  }
}

function writeReport() {
  const start = "<!-- walkthroughs:start -->";
  const end = "<!-- walkthroughs:end -->";
  let text = fs.existsSync(REPORT) ? fs.readFileSync(REPORT, "utf8") : `# Check report\n\n## Walk-throughs\n\n${start}\n${end}\n`;
  if (!text.includes(start)) text += `\n## Walk-throughs\n\n${start}\n${end}\n`;
  const section = text.slice(text.indexOf(start) + start.length, text.indexOf(end));
  const blocks = new Map<number, string>();
  for (const m of section.matchAll(/<!-- wt-(\d+) -->([\s\S]*?)<!-- \/wt-\1 -->/g)) blocks.set(Number(m[1]), m[0]);
  const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
  for (const r of runs) {
    const taps = r.steps.reduce((s, x) => s + x.taps, 0);
    const typed = r.steps.reduce((s, x) => s + x.typed, 0);
    const rows = r.steps.map((s) => `| ${s.step} | ${s.taps} | ${s.typed} |`).join("\n");
    blocks.set(
      r.n,
      `<!-- wt-${r.n} -->\n### Walk-through ${r.n}: ${r.title}\n\nRun ${stamp} UTC, Playwright at 375x667. Result: **${r.passed ? "passed" : "failed"}**. ${r.steps.length} screens, ${taps} taps, ${typed} typed fields.${r.notes.length ? `\n\n${r.notes.map((n) => `- ${n}`).join("\n")}` : ""}\n\n| Screen | Taps | Typed fields |\n|---|---|---|\n${rows}\n| **Total** | **${taps}** | **${typed}** |\n<!-- /wt-${r.n} -->`,
    );
  }
  const body = [...blocks.entries()].sort((a, b) => a[0] - b[0]).map(([, b]) => b).join("\n\n");
  text = text.slice(0, text.indexOf(start) + start.length) + `\n${body}\n` + text.slice(text.indexOf(end));
  fs.mkdirSync("docs", { recursive: true });
  fs.writeFileSync(REPORT, text);
}

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync("screenshots", { recursive: true });
  const context = await browser.newContext({
    baseURL: "http://localhost:3000",
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  page = await context.newPage();
});

test.afterAll(() => writeReport());

test("walk-through 1: new parent, one child (age 4) at Madison, with the sample fill", async () => {
  begin(1, "New parent, one child (age 4) at Madison, with Fill in a sample family");
  screen("Start");
  await page.goto("/sign-up");
  await check("start");
  await expect(page.getByText("Already with us? Moving your family over is coming next.")).toBeVisible();

  screen("Sandbox: Fill in a sample family");
  await openSandbox();
  await check("sandbox-sheet", { family: false });
  await tap(page.getByRole("button", { name: "Fill in a sample family" }));
  await expect(page).toHaveURL(/\/sign-up\/pool$/);

  screen("1 Pool");
  await check("pool");
  await expect(page.getByTestId("step-count")).toHaveText("Step 1 of 9");
  await tap(page.getByRole("button", { name: /^Madison/ }));

  screen("2 Your swimmers");
  await expect(page).toHaveURL(/\/sign-up\/swimmers$/);
  await expect(page.getByLabel("First name")).toHaveValue("Mia");
  await expect(page.getByText("Every child 3 and under, and any child who isn't toilet-trained, wears a snug reusable swim diaper.")).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/toilet-trained\?/);
  await check("swimmers");
  await tap(page.getByRole("button", { name: "Continue" }));

  screen("3 Stage");
  await expect(page.getByRole("heading", { name: "Which sounds most like Mia today?" })).toBeVisible();
  await check("stage");
  await tap(page.getByRole("button", { name: /^The Shallows/ }));

  screen("4 Times");
  await expect(page).toHaveURL(/\/sign-up\/times\?child=1$/);
  const option = page.getByTestId("time-mad-sun-1000-shallows");
  await expect(option).toContainText("Bank draft");
  const priceText = await option.getByTestId("prices").innerText();
  expect(priceText.indexOf("Bank draft")).toBeLessThan(priceText.indexOf("Card"));
  expect(priceText).toContain("$34.00 a lesson");
  expect(priceText).toContain("$35.00 a lesson");
  await expect(page.getByTestId("time-mad-wed-1630-shallows")).toContainText("Full");
  await check("times");
  const spotsBefore = (await stored()).classes.find((c: { id: string }) => c.id === "mad-sun-1000-shallows").openSpots;
  await tap(option);

  screen("5 You and the code");
  await expect(page).toHaveURL(/\/sign-up\/you$/);
  await expect(page.getByLabel("Your name")).toHaveValue("Jordan Sample");
  await tap(page.getByRole("button", { name: "Send my code" }));
  await expect(page.getByText("Email confirmed")).toBeVisible();
  await check("you");
  await tap(page.getByRole("button", { name: "A friend, neighbor or family member" }));

  screen("6 Your people");
  await expect(page).toHaveURL(/\/sign-up\/people$/);
  await expect(page.getByLabel("Contact 1 name")).not.toHaveValue("");
  await check("people");
  await tap(page.getByRole("button", { name: "Skip and continue" }));

  screen("7 Who stays");
  await expect(page).toHaveURL(/\/sign-up\/who-stays$/);
  await expect(page.getByText(/^There's no drop-off\./)).toBeVisible();
  await check("who-stays");
  await tap(page.getByRole("button", { name: "Just me for now" }));

  screen("8 Payment");
  await expect(page).toHaveURL(/\/sign-up\/payment$/);
  await expect(page.getByText("Nothing is charged today.")).toBeVisible();
  await expect(page.locator("main input")).toHaveCount(0);
  await tap(page.getByRole("button", { name: /^Bank draft/ }));
  await tap(page.getByLabel("I authorize these bank drafts"));
  await tap(page.getByRole("button", { name: "Add a backup card (sample)" }));
  await expect(page.getByText("We'd only charge this card if a bank draft comes back unpaid, after we tell you, at the card price.")).toBeVisible();
  await check("payment");
  await tap(page.getByRole("button", { name: "Continue" }));

  screen("9 Family release");
  await expect(page).toHaveURL(/\/sign-up\/release$/);
  await expect(page.getByTestId("covers")).toHaveText("Covers Mia");
  await checkReleaseBoxes();
  await tap(page.getByRole("radio", { name: "No" }).first());
  await tap(page.getByRole("radio", { name: "No" }).nth(1));
  await expect(page.getByLabel("Your full name")).toHaveValue("Jordan Sample");
  await tap(page.getByLabel("I agree to this release and to signing it electronically"));
  await check("release");
  const before = await stored();
  await tap(page.getByRole("button", { name: "Sign and save my spot" }));

  screen("You're in");
  await expect(page).toHaveURL(/\/sign-up\/youre-in$/);
  await expect(page.getByRole("heading", { name: "You're in" })).toBeVisible();
  const booked = page.getByTestId("booked-child");
  await expect(booked).toHaveCount(1);
  await expect(booked.getByTestId("first-lesson-when")).toContainText(/Sunday, \w+ \d+, 10:00 am/);
  await expect(booked.getByTestId("first-lesson-where")).toHaveText("Madison with Coach Dev");
  await expect(booked.getByTestId("price-they-pay")).toHaveText("$34.00 a lesson by bank draft");
  await expect(page.getByText("Nothing was charged today. Your first bill comes before your first lesson.")).toBeVisible();
  await expect(page.getByText("Sample only. No real spot was saved and no one at the pool was told.")).toBeVisible();
  await check("youre-in");
  const after = await stored();
  expect(after.classes.find((c: { id: string }) => c.id === "mad-sun-1000-shallows").openSpots).toBe(spotsBefore - 1);
  expect(after.releaseSignatures.length).toBe(before.releaseSignatures.length + 1);
  expect(after.bankDraftAuthorizations.length).toBe(before.bankDraftAuthorizations.length + 1);
  expect(after.families.length).toBe(before.families.length + 1);
  run!.notes.push("One spot gone from Sundays at 10:00 am; one release signature and one bank-draft authorization saved.");

  // A refresh books nothing.
  await page.reload();
  await expect(page.getByRole("heading", { name: "You're in" })).toBeVisible();
  const refreshed = await stored();
  expect(refreshed.families.length).toBe(after.families.length);
  expect(refreshed.releaseSignatures.length).toBe(after.releaseSignatures.length);
  expect(refreshed.classes.find((c: { id: string }) => c.id === "mad-sun-1000-shallows").openSpots).toBe(spotsBefore - 1);
  run!.notes.push("Refreshing You're in booked nothing.");

  screen("See your first lesson");
  await tap(page.getByRole("button", { name: "See your first lesson" }));
  await expect(page).toHaveURL(/\/first-lesson$/);
  await expect(page.getByRole("heading", { name: "Your first lesson" })).toBeVisible();
  await expect(page.getByTestId("lesson-ticket")).toContainText("Mia");
  run!.passed = true;
});

test("walk-through 5: cold run, one child at Madison, every field typed, paying by card", async () => {
  begin(5, "Cold run: one child at Madison, every field typed (no fill button), paying by card");
  const birth = datePartsYearsAgo(5, 2);
  screen("Start");
  await page.goto("/sign-up");
  await check("start");
  await tap(page.getByRole("button", { name: "Start" }));

  screen("1 Pool");
  await tap(page.getByRole("button", { name: /^Madison/ }));

  screen("2 Your swimmers");
  await type(page.getByLabel("First name"), "Ada");
  await type(page.getByLabel("Month"), birth.m);
  await type(page.getByLabel("Day"), birth.d);
  await type(page.getByLabel("Year"), birth.y);
  await check("swimmers");
  await tap(page.getByRole("button", { name: "Continue" }));

  screen("3 Stage");
  await tap(page.getByRole("button", { name: /^The Pier/ }));

  screen("4 Times");
  const option = page.getByTestId("time-mad-sun-0930-pier");
  // The card price shows before they choose.
  await expect(option.getByTestId("prices")).toContainText("Card$35.00 a lesson");
  await expect(option).toContainText("No partner yet. You pay the semi-private price for the first month.");
  await check("times");
  await tap(option);

  screen("5 You and the code");
  await type(page.getByLabel("Your name"), "Sam Example");
  await type(page.getByLabel("Email"), "sam.example@example.com");
  await type(page.getByLabel("Phone"), "404-555-0177");
  await tap(page.getByRole("button", { name: "Send my code" }));
  await expect(page.getByTestId("sample-code")).toHaveText("Sample code: 246810");
  await expect(page.getByLabel("6-digit code")).toHaveAttribute("autocomplete", "one-time-code");
  await type(page.getByLabel("6-digit code"), "246810");
  await expect(page.getByText("Email confirmed")).toBeVisible();
  await check("you");
  await tap(page.getByRole("button", { name: "A web search" }));

  screen("6 Your people");
  await type(page.getByLabel("Contact 1 name"), "Lee Example");
  await type(page.getByLabel("Contact 1 phone"), "404-555-0181");
  await type(page.getByLabel("Contact 2 name"), "Kim Example");
  await type(page.getByLabel("Contact 2 phone"), "404-555-0182");
  await tap(page.getByRole("button", { name: "Skip and continue" }));

  screen("7 Who stays");
  await tap(page.getByRole("button", { name: "Just me for now" }));

  screen("8 Payment");
  const card = page.getByRole("button", { name: /^Card/ });
  await expect(card).toContainText("$35.00 a lesson");
  await expect(page.getByRole("button", { name: /^Bank draft/ })).toContainText("$34.00 a lesson");
  await tap(card);
  await check("payment");
  await tap(page.getByRole("button", { name: "Continue" }));

  screen("9 Family release");
  await checkReleaseBoxes();
  await tap(page.getByRole("radio", { name: "No" }).first());
  await tap(page.getByRole("radio", { name: "No" }).nth(1));
  await type(page.getByLabel("Your full name"), "Sam Example");
  await tap(page.getByLabel("I agree to this release and to signing it electronically"));
  await tap(page.getByRole("button", { name: "Sign and save my spot" }));

  screen("You're in");
  await expect(page).toHaveURL(/\/sign-up\/youre-in$/);
  await expect(page.getByTestId("price-they-pay")).toHaveText("$35.00 a lesson by card");
  await check("youre-in");
  run!.passed = true;
});

test("walk-through 6: the first Sunday, continuing walk-through 1", async () => {
  begin(6, "The first Sunday, continuing walk-through 1 (and walk-through 2's family on deck)");
  screen("Sandbox: play as Mia's family");
  await page.goto("/");
  await openSandbox();
  await tap(page.getByRole("button", { name: /^Mia's family/ }));
  await expect(page).toHaveURL(/\/$/);

  screen("Home before the first lesson");
  await expect(page.getByTestId("home-lead")).toContainText("Your first lesson");
  await check("home-before");
  await tap(page.getByRole("navigation", { name: "Family tabs" }).getByRole("link", { name: "First lesson" }));

  screen("Your first lesson");
  await expect(page).toHaveURL(/\/first-lesson$/);
  await expect(page.getByTestId("lesson-ticket")).toContainText("Mia");
  await expect(page.getByTestId("lesson-ticket")).toContainText("The lesson runs 27 minutes.");
  await expect(page.getByTestId("at-a-glance")).toContainText("Park");
  await expect(page.getByTestId("parking")).toContainText("Park in the side lot");
  await expect(page.getByTestId("door")).toContainText("blue side door");
  await expect(page.getByTestId("arrive")).toContainText("Arrive 10 minutes early");
  await expect(page.getByTestId("bring")).toContainText("A towel");
  await expect(page.getByTestId("who-stays")).toContainText("No drop-off.");
  await expect(page.getByTestId("at-a-glance")).toContainText("You, the whole lesson. No drop-off.");
  await expect(page.getByTestId("who-stays").getByTestId("listed-adult")).toHaveCount(0);
  await expect(page.getByTestId("email-us")).toHaveText("Need to miss, move or stop? Email us at madison.sample@example.com.");
  // Where, what and who show on the first screen for one child.
  const glance = await page.getByTestId("at-a-glance").boundingBox();
  expect(glance && glance.y + glance.height).toBeLessThanOrEqual(667 - 64);
  await check("first-lesson");

  screen("Sandbox: Pretend the first lesson happened");
  await openSandbox();
  await tap(page.getByRole("button", { name: "Pretend the first lesson happened" }));
  await expect(page).toHaveURL(/\/$/);

  screen("Home after the first lesson");
  const lead = page.getByTestId("home-lead");
  await expect(lead).toContainText("How it went for Mia");
  await expect(lead).toContainText("Sample note");
  await check("home-after");
  await tap(page.getByRole("navigation", { name: "Family tabs" }).getByRole("link", { name: "Progress" }));

  screen("Progress: How it went");
  await expect(page).toHaveURL(/\/progress$/);
  const notes = page.getByTestId("how-it-went");
  await expect(notes).toHaveCount(1);
  await expect(notes.getByTestId("note-stage")).toHaveText(", The Shallows");
  await expect(notes.getByTestId("coach-lines").locator("p")).toHaveCount(2);
  await expect(notes.getByTestId("coach-lines")).toContainText(/^Today Mia /);
  await expect(notes.getByTestId("on-deck")).toHaveText("On deck: you");
  await expect(notes).toContainText("Approved by Coach Dev");
  await expect(notes).toContainText("Sample note");
  await expect(page.locator("main")).not.toContainText(/tier|level \d|\d+ of \d+ skills/i);
  await expect(page.locator("main")).not.toContainText("Ada");
  await expect(page.getByText("Lesson clips come in a later version.")).toBeVisible();
  await expect(page.locator("main img, main video")).toHaveCount(0);
  await check("progress");
  const marks = (await stored()).attendanceMarks.length;

  screen("Sandbox: press it again");
  await openSandbox();
  await tap(page.getByRole("button", { name: "Pretend the first lesson happened" }));
  await expect(page.getByRole("dialog")).toContainText("Nothing new to add.");
  await page.keyboard.press("Escape");
  expect((await stored()).attendanceMarks.length).toBe(marks);
  await expect(page.getByTestId("how-it-went")).toHaveCount(1);
  run!.notes.push("Pressing Pretend the first lesson happened again added nothing.");
  run!.passed = true;
});
