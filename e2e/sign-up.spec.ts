import { test, expect, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";

/*
  The walk-throughs, in order, as one serial group sharing one page, so
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
  await shoot(`walkthrough-${run!.n}-${String(shotIndex).padStart(2, "0")}-${name}`);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${name}: ${v.id}: ${v.help}`)).toEqual([]);
  if (opts.family !== false) {
    const text = await page.locator("main").innerText();
    for (const [re, why] of FAMILY_BANNED) expect(re.test(text), `${name} has ${why}: ${text.match(re)?.[0]}`).toBe(false);
    if (/drop-off/i.test(text)) expect(text).not.toMatch(/(?<!no )drop-off(?! )/i);
  }
}

/** A full-page shot, plus phone-screen slices of long pages so a reviewer can read them. */
async function shoot(base: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `screenshots/${base}.png`, fullPage: true });
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  // Anything taller than one phone screen also gets phone-height slices, since the fixed tab bar sits across a full-page shot.
  if (height <= 667) return;
  let part = 1;
  for (let top = 0; top < height - 200; top += 480, part += 1) {
    await page.evaluate((y) => window.scrollTo(0, y), top);
    await page.screenshot({ path: `screenshots/${base}-part${part}.png` });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
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
  const priceText = (await option.getByTestId("prices").innerText()).replace(/\s+/g, " ");
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
  await expect(booked.getByTestId("first-lesson-when")).toContainText(/Sunday, \w+\s\d+, 10:00\sam/);
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

test("walk-through 2: two children at Buckhead (3 and 6) with a grandmother listed", async () => {
  begin(2, "Two children at Buckhead (ages 3 and 6) with a grandmother listed");
  const leo = datePartsYearsAgo(3, 2);
  const ada = datePartsYearsAgo(6, 5);
  screen("Start");
  await page.goto("/sign-up");
  await tap(page.getByRole("button", { name: "Start" }));

  screen("1 Pool");
  await tap(page.getByRole("button", { name: /^Buckhead/ }));

  screen("2 Your swimmers");
  await type(page.getByLabel("First name"), "Leo");
  await type(page.getByLabel("Month"), leo.m);
  await type(page.getByLabel("Day"), leo.d);
  await type(page.getByLabel("Year"), leo.y);
  await tap(page.getByRole("button", { name: "Add another swimmer" }));
  await type(page.getByLabel("First name").nth(1), "Ada");
  await type(page.getByLabel("Month").nth(1), ada.m);
  await type(page.getByLabel("Day").nth(1), ada.d);
  await type(page.getByLabel("Year").nth(1), ada.y);
  await check("swimmers");
  await tap(page.getByRole("button", { name: "Continue" }));

  screen("3 Stage for Leo");
  await expect(page.getByTestId("step-count")).toHaveText("Step 3 of 11");
  await tap(page.getByRole("button", { name: /^The Pier/ }));
  screen("3 Stage for Ada");
  await expect(page.getByRole("heading", { name: "Which sounds most like Ada today?" })).toBeVisible();
  await tap(page.getByRole("button", { name: /^The Cove/ }));

  screen("4 Times for Leo");
  await expect(page.getByRole("heading", { name: "Pick a time for Leo" })).toBeVisible();
  const leoTime = page.getByTestId("time-buc-sun-0930-pier");
  await expect(leoTime).toContainText(/First lesson Sunday, November\s(8|1[5-9]|2\d|30)/);
  await tap(leoTime);

  screen("4 Times for Ada");
  await expect(page.getByRole("heading", { name: "Pick a time for Ada" })).toBeVisible();
  const first = page.locator('[data-testid^="time-"]').first();
  await expect(first).toHaveAttribute("data-testid", "time-buc-sun-0900-cove");
  await expect(first).toContainText("Full");
  await expect(first.getByRole("button")).toHaveText("Join the waitlist");
  await tap(first.getByRole("button", { name: "Join the waitlist" }));
  await expect(first.getByRole("button")).toContainText("On the waitlist");
  const next = page.getByTestId("time-buc-sun-1000-cove");
  await expect(next).toContainText("Next to Leo's lesson");
  for (const text of await page.locator('[data-testid^="time-"]').allInnerTexts()) {
    for (const m of text.matchAll(/(?:First lesson|) ?\w+day, (\w+)\s(\d+)/g)) {
      const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      const monthIndex = months.indexOf(m[1]);
      if (monthIndex >= 0) expect(monthIndex > 10 || (monthIndex === 10 && Number(m[2]) >= 8) || monthIndex < 9).toBe(true);
    }
  }
  await check("times-ada");
  await tap(next);

  screen("5 You and the code");
  await type(page.getByLabel("Your name"), "Robin Example");
  await type(page.getByLabel("Email"), "robin.example@example.com");
  await type(page.getByLabel("Phone"), "404-555-0165");
  await tap(page.getByRole("button", { name: "Send my code" }));
  await type(page.getByLabel("6-digit code"), "246810");
  await tap(page.getByRole("button", { name: "My child's school or preschool" }));

  screen("Close the tab and come back");
  await expect(page).toHaveURL(/\/sign-up\/people$/);
  const context = page.context();
  await page.close();
  page = await context.newPage();
  await page.goto("/sign-up");
  await check("pick-up");
  await tap(page.getByRole("button", { name: "Pick up where you left off" }));
  await expect(page).toHaveURL(/\/sign-up\/people$/);
  run!.notes.push("Closed the tab at Your people; Pick up where you left off came back to Your people.");

  screen("6 Your people");
  await type(page.getByLabel("Contact 1 name"), "Morgan Example");
  await type(page.getByLabel("Contact 1 phone"), "404-555-0166");
  await type(page.getByLabel("Contact 2 name"), "Avery Example");
  await type(page.getByLabel("Contact 2 phone"), "404-555-0167");
  await tap(page.getByRole("button", { name: "Skip and continue" }));

  screen("7 Who stays");
  await type(page.getByLabel("First name"), "Rose");
  await tap(page.getByRole("radio", { name: "Grandparent" }));
  await tap(page.getByRole("button", { name: "Add this adult" }));
  const rose = page.getByTestId("listed-adult");
  await expect(rose).toContainText("Rose, grandparent");
  await expect(rose).toContainText("Waiting");
  await expect(rose.getByTestId("email-us-first")).toContainText(
    "For now, if the only adult staying would be someone other than a parent or guardian, email us before the lesson so we can confirm it.",
  );
  await check("who-stays");
  await tap(page.getByRole("button", { name: "Continue" }));

  screen("8 Payment");
  await tap(page.getByRole("button", { name: /^Bank draft/ }));
  await tap(page.getByLabel("I authorize these bank drafts"));
  await tap(page.getByRole("button", { name: "Add a backup card (sample)" }));
  await tap(page.getByRole("button", { name: "Continue" }));

  screen("9 Family release");
  await expect(page.getByTestId("covers")).toHaveText("Covers Leo and Ada");
  await checkReleaseBoxes();
  await tap(page.getByRole("radio", { name: "No" }).nth(0));
  await tap(page.getByRole("radio", { name: "No" }).nth(1));
  await tap(page.getByRole("radio", { name: "Yes" }).nth(2));
  await expect(page.getByText("Thanks. Someone from the school will talk with you before the first lesson.")).toBeVisible();
  await tap(page.getByRole("radio", { name: "No" }).nth(3));
  await type(page.getByLabel("Your full name"), "Robin Example");
  await tap(page.getByLabel("I agree to this release and to signing it electronically"));
  await check("release");
  const before = await stored();
  await tap(page.getByRole("button", { name: "Sign and save my spot" }));

  screen("You're in");
  await expect(page).toHaveURL(/\/sign-up\/youre-in$/);
  const booked = page.getByTestId("booked-child");
  await expect(booked).toHaveCount(2);
  for (const card of await booked.all()) await expect(card.getByTestId("first-lesson-when")).toContainText(/Sunday, November\s(8|1[5-9]|2\d|30)/);
  await expect(booked.nth(1)).toContainText("On the waitlist for Sundays at 9:00 am");
  await expect(booked.nth(1)).toContainText("Thanks. Someone from the school will talk with you before the first lesson.");
  await expect(booked.nth(0)).not.toContainText("Someone from the school");
  await check("youre-in");
  const after = await stored();
  const family = after.families[after.families.length - 1];
  const kids = after.children.filter((c: { familyId: string }) => c.familyId === family.id);
  expect(kids.find((k: { firstName: string }) => k.firstName === "Ada").flaggedForPerson).toBe(true);
  expect(kids.find((k: { firstName: string }) => k.firstName === "Leo").flaggedForPerson).toBe(false);
  expect(after.releaseSignatures.length).toBe(before.releaseSignatures.length + 1);
  expect(after.releaseSignatures[after.releaseSignatures.length - 1].children.map((c: { firstName: string }) => c.firstName)).toEqual(["Leo", "Ada"]);
  run!.notes.push("One release covers Leo and Ada; Ada is flagged for a person; no Buckhead date before Sunday, November 8, 2026.");
  run!.passed = true;
});

test("walk-through 3: two-year-olds at Buckhead and Madison", async () => {
  begin(3, "A 2-year-old at Buckhead (told when they can start), then at Madison (private, parent in the water, free evaluation only)");
  const ivy = datePartsYearsAgo(2, 5);
  screen("Start");
  await page.goto("/sign-up");
  await tap(page.getByRole("button", { name: "Start" }));
  screen("1 Pool");
  await tap(page.getByRole("button", { name: /^Buckhead/ }));
  screen("2 Your swimmers");
  await type(page.getByLabel("First name"), "Ivy");
  await type(page.getByLabel("Month"), ivy.m);
  await type(page.getByLabel("Day"), ivy.d);
  await type(page.getByLabel("Year"), ivy.y);
  await tap(page.getByRole("button", { name: "Continue" }));
  screen("3 Stage");
  await tap(page.getByRole("button", { name: /^The Pier/ }));

  screen("4 Times at Buckhead");
  const tooYoung = page.getByTestId("too-young");
  await expect(tooYoung).toContainText(/Ivy can start at Buckhead from \w+day, \w+\s\d+/);
  await check("too-young-buckhead");
  await tap(page.getByRole("button", { name: "See Madison times" }));

  screen("4 Times at Madison");
  await expect(page.getByText("Ivy is under 3, so lessons are private, with you in the water.", { exact: false })).toBeVisible();
  const classTimes = page.getByRole("region", { name: "Times for Ivy" }).locator('[data-testid^="time-"]');
  await expect(classTimes).toHaveCount(1);
  await expect(classTimes.first()).toContainText("Private with Coach Marisol");
  await expect(classTimes.first()).toContainText("You're in the water too.");
  await expect(page.getByRole("heading", { name: "Or start with a free evaluation" })).toBeVisible();
  await check("under-3-madison");
  await tap(page.getByTestId("time-mad-eval-sun-1100"));

  screen("5 You and the code");
  await type(page.getByLabel("Your name"), "Casey Example");
  await type(page.getByLabel("Email"), "casey.example@example.com");
  await type(page.getByLabel("Phone"), "404-555-0170");
  await tap(page.getByRole("button", { name: "Send my code" }));
  await type(page.getByLabel("6-digit code"), "246810");
  await tap(page.getByRole("button", { name: "An online parent group" }));
  screen("6 Your people");
  await type(page.getByLabel("Contact 1 name"), "Jesse Example");
  await type(page.getByLabel("Contact 1 phone"), "404-555-0171");
  await type(page.getByLabel("Contact 2 name"), "Drew Example");
  await type(page.getByLabel("Contact 2 phone"), "404-555-0172");
  await tap(page.getByRole("button", { name: "Skip and continue" }));
  screen("7 Who stays");
  await tap(page.getByRole("button", { name: "Just me for now" }));

  screen("8 Payment: evaluation only");
  await expect(page.getByText("The free evaluation is never charged.")).toBeVisible();
  await tap(page.getByRole("button", { name: "Add a card to hold the spot (sample)" }));
  await check("payment-evaluation");
  await tap(page.getByRole("button", { name: "Continue" }));

  screen("9 Family release");
  await checkReleaseBoxes();
  await tap(page.getByRole("radio", { name: "No" }).nth(0));
  await tap(page.getByRole("radio", { name: "No" }).nth(1));
  await type(page.getByLabel("Your full name"), "Casey Example");
  await tap(page.getByLabel("I agree to this release and to signing it electronically"));
  await tap(page.getByRole("button", { name: "Sign and save my spot" }));

  screen("You're in");
  await expect(page.getByTestId("price-they-pay")).toHaveText("The free evaluation is never charged.");
  await expect(page.getByText("Nothing was charged today. The free evaluation is never charged.")).toBeVisible();
  await check("youre-in");
  run!.passed = true;
});

test("walk-through 4: the family moving over", async () => {
  begin(4, "The family moving over (two children at Madison)");
  screen("Sandbox: Family moving over");
  await page.goto("/");
  await openSandbox();
  await tap(page.getByRole("button", { name: /^Family moving over/ }));
  await expect(page).toHaveURL(/\/move-over$/);

  screen("Welcome");
  await expect(page.getByRole("heading", { name: "Welcome to the new Popsicle Pier app." })).toBeVisible();
  await check("welcome");
  await tap(page.getByRole("button", { name: "Let's start" }));

  screen("1 Your details");
  await expect(page.getByTestId("move-details")).toContainText("dana.whitcombe@example.com");
  await expect(page.locator("main input")).toHaveCount(0);
  await check("details");
  await tap(page.getByRole("button", { name: "Looks right" }));
  screen("2 Your people");
  await expect(page.getByTestId("listed-adult")).toContainText("Waiting");
  await check("people");
  await tap(page.getByRole("button", { name: "Looks right" }));
  screen("3 Your classes");
  await expect(page.getByTestId("move-class")).toHaveCount(2);
  await check("classes");
  await tap(page.getByRole("button", { name: "Looks right" }));

  screen("4 Confirm your email");
  await tap(page.getByRole("button", { name: "Send my code" }));
  await type(page.getByLabel("6-digit code"), "246810");
  await expect(page.getByText("Email confirmed")).toBeVisible();
  await check("email");
  await tap(page.getByRole("button", { name: "Continue" }));

  screen("5 Payment");
  await tap(page.getByRole("button", { name: /^Bank draft/ }));
  await tap(page.getByLabel("I authorize these bank drafts"));
  await tap(page.getByRole("button", { name: "Add a backup card (sample)" }));
  await check("payment");
  await tap(page.getByRole("button", { name: "Continue" }));

  screen("6 Family release");
  await expect(page.getByTestId("covers")).toHaveText("Covers Juniper and Theo");
  await checkReleaseBoxes();
  for (let i = 0; i < 4; i++) await tap(page.getByRole("radio", { name: "No" }).nth(i));
  await type(page.getByLabel("Your full name"), "Dana Whitcombe");
  await tap(page.getByLabel("I agree to this release and to signing it electronically"));
  await check("release");
  const before = await stored();
  await tap(page.getByRole("button", { name: "Sign and save my spot" }));

  screen("Home");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("home-child")).toHaveCount(2);
  await expect(page.getByTestId("home-pay")).toHaveText("Bank draft, with a backup card");
  await expect(page.getByTestId("home-release")).toContainText("You signed version 2");
  await check("home");
  const after = await stored();
  expect(after.releaseSignatures.length).toBe(before.releaseSignatures.length + 1);
  expect(after.releaseSignatures[after.releaseSignatures.length - 1].children.map((c: { firstName: string }) => c.firstName)).toEqual(["Juniper", "Theo"]);
  expect(after.bankDraftAuthorizations.length).toBe(before.bankDraftAuthorizations.length + 1);
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
  await type(page.getByLabel("First name"), "Noa");
  await type(page.getByLabel("Month"), birth.m);
  await type(page.getByLabel("Day"), birth.d);
  await type(page.getByLabel("Year"), birth.y);
  // Continue is on the first screen of a phone, without scrolling.
  await page.evaluate(() => window.scrollTo(0, 0));
  const cont = await page.getByRole("button", { name: "Continue" }).boundingBox();
  expect(cont && cont.y + cont.height).toBeLessThanOrEqual(667);
  await check("swimmers");
  await tap(page.getByRole("button", { name: "Continue" }));

  screen("3 Stage");
  await tap(page.getByRole("button", { name: /^The Pier/ }));

  screen("4 Times");
  const option = page.getByTestId("time-mad-sun-0930-pier");
  // The card price shows before they choose.
  await expect(option.getByTestId("prices")).toContainText(/Card\s*\$35\.00\sa\slesson/);
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

  screen("Sandbox: play as Leo and Ada's family");
  await openSandbox();
  await tap(page.getByRole("button", { name: /^Leo and Ada's family/ }));
  screen("Sandbox: Pretend for walk-through 2's family");
  await openSandbox();
  await tap(page.getByRole("button", { name: "Pretend the first lesson happened" }));
  await expect(page).toHaveURL(/\/$/);
  // Ada's custody yes holds her first lesson until a person talks with the family (walk-through 9 records the talk).
  await expect(page.getByTestId("home-child").filter({ hasText: "Ada" }).getByTestId("home-talk")).toHaveText(
    "Thanks. Someone from the school will talk with you before the first lesson.",
  );
  screen("Progress for walk-through 2's family");
  await tap(page.getByRole("navigation", { name: "Family tabs" }).getByRole("link", { name: "Progress" }));
  const deck = page.getByTestId("on-deck");
  await expect(deck).toHaveCount(1);
  await expect(page.getByTestId("note-not-yet")).toContainText("Ada's first lesson on");
  for (const line of await deck.allInnerTexts()) {
    expect(line).toBe("On deck: you");
    expect(line).not.toContain("Rose");
  }
  const marksNow = (await stored()).attendanceMarks.filter((m: { adult: { kind: string } }) => m.adult.kind !== "parent");
  expect(marksNow).toHaveLength(0);
  await check("progress-family-2");
  run!.notes.push("Walk-through 2's Waiting grandmother, Rose, was never named as the adult on deck. Ada's first lesson waits for a talk about her custody yes.");
  run!.passed = true;
});

test("walk-through 7: add a brother or sister, then another class at the other pool", async () => {
  begin(7, "Add a brother or sister to walk-through 1's family, then another class for Mia at the other pool");
  const familyOf = (data: { families: { id: string }[]; children: { familyId: string; firstName: string }[] }, name: string) =>
    data.families.find((f) => data.children.some((c) => c.familyId === f.id && c.firstName === name))!.id;

  screen("Sandbox: play as Mia's family");
  await page.goto("/");
  await openSandbox();
  await tap(page.getByRole("button", { name: /^Mia's family/ }));
  await expect(page).toHaveURL(/\/$/);

  screen("Home");
  await tap(page.getByTestId("add-child-card").getByRole("button", { name: "Add a child or a class" }));

  screen("Add a child or a class");
  await expect(page).toHaveURL(/\/family\/add$/);
  await check("add-start");
  await tap(page.getByRole("button", { name: /^A brother or sister/ }));

  screen("1 A brother or sister");
  const jules = datePartsYearsAgo(3, 4);
  await type(page.getByLabel("First name"), "Jules");
  await type(page.getByLabel("Month"), jules.m);
  await type(page.getByLabel("Day"), jules.d);
  await type(page.getByLabel("Year"), jules.y);
  await expect(page.getByTestId("step-count")).toHaveText("Step 1 of 5");
  await check("add-child");
  await tap(page.getByRole("button", { name: "Continue" }));

  screen("2 Stage");
  await tap(page.getByRole("button", { name: /^The Pier/ }));

  screen("3 Pick a time");
  const option = page.getByTestId("time-mad-sun-0930-pier");
  await expect(option).toContainText("Next to Mia's lesson");
  await expect(option.getByTestId("prices")).toContainText(/Bank draft\s*\$34\.00/);
  await check("add-times");
  const before = await stored();
  await tap(option);

  screen("4 A few things about Jules");
  await expect(page.getByRole("heading", { name: "A few things about Jules" })).toBeVisible();
  await expect(page.getByText(/already covers Jules\. There's nothing new to sign\./)).toBeVisible();
  await tap(page.getByRole("radio", { name: "No" }).nth(0));
  await tap(page.getByRole("radio", { name: "No" }).nth(1));
  await check("add-questions");
  await tap(page.getByRole("button", { name: "Continue" }));

  screen("5 Check and add");
  await expect(page.getByTestId("add-price")).toHaveText("$34.00 a lesson by bank draft");
  await expect(page.getByText("Nothing is charged today.")).toBeVisible();
  await expect(page.getByText("Your family release, version 2, covers Jules too. Nothing new to sign.")).toBeVisible();
  await check("add-review");
  await tap(page.getByRole("button", { name: "Add Jules" }));

  screen("Added");
  await expect(page).toHaveURL(/\/family\/add\/done$/);
  await expect(page.getByRole("heading", { name: "Jules is signed up" })).toBeVisible();
  await expect(page.getByTestId("added-where")).toHaveText("Madison with Coach Dev");
  await check("add-done");
  const after = await stored();
  const familyId = familyOf(after, "Mia");
  const kids = after.children.filter((c: { familyId: string }) => c.familyId === familyId);
  const julesRow = kids.find((c: { firstName: string }) => c.firstName === "Jules");
  expect(julesRow.childId).toMatch(/^PP26-\d{4}$/);
  expect(after.releaseSignatures.length).toBe(before.releaseSignatures.length);
  expect(after.coverages.length).toBe(before.coverages.length + 1);
  expect(after.coverages[after.coverages.length - 1].childRecordId).toBe(julesRow.id);
  expect(after.consents.length).toBe(before.consents.length + 3);
  // A refresh adds nothing.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Jules is signed up" })).toBeVisible();
  expect((await stored()).children.length).toBe(after.children.length);
  run!.notes.push("Jules was covered by the family's current release with a coverage row and three consent rows; nothing new was signed; a refresh added nothing.");

  screen("Home again");
  await tap(page.getByRole("button", { name: "Go to Home" }));
  await tap(page.getByTestId("add-child-card").getByRole("button", { name: "Add a child or a class" }));
  screen("Another class for Mia");
  await tap(page.getByRole("button", { name: "Another class for Mia" }));

  screen("1 Pick a time at the other pool");
  await expect(page.getByTestId("step-count")).toHaveText("Step 1 of 2");
  await expect(page.getByTestId("time-mad-sun-1000-shallows")).toHaveCount(0);
  await tap(page.getByRole("button", { name: "See Buckhead times instead" }));
  const wed = page.getByTestId("time-buc-wed-1600-shallows");
  await expect(wed).toContainText(/Wednesdays at 4:00\spm/);
  await check("add-class-times");
  await tap(wed);

  screen("2 Check and add");
  await tap(page.getByRole("button", { name: "Add this class" }));

  screen("Added");
  await expect(page.getByRole("heading", { name: "Mia's Wednesday class is added" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "First time at Buckhead?" })).toBeVisible();
  await check("add-class-done");
  const final = await stored();
  const mia = final.children.find((c: { familyId: string; firstName: string }) => c.familyId === familyId && c.firstName === "Mia");
  expect(mia.childId).toBe("PP26-0042");
  const miaPools = final.enrollments.filter((e: { childRecordId: string }) => e.childRecordId === mia.id).map((e: { poolId: string }) => e.poolId).sort();
  expect(miaPools).toEqual(["pool-buckhead", "pool-madison"]);
  run!.notes.push("Mia's second class is at Buckhead and she keeps PP26-0042 across both pools.");

  screen("Lesson dates");
  await tap(page.getByRole("button", { name: "See lesson dates" }));
  await expect(page.getByTestId("lesson-dates")).toHaveCount(3);
  await check("lesson-dates");
  run!.passed = true;
});

test("walk-through 8: bills and a note, continuing walk-throughs 1 and 7", async () => {
  begin(8, "Walk-through 1 and 7's family reads its bills and sends a note that Mia will miss a lesson");
  screen("Sandbox: play as Mia's family");
  await page.goto("/");
  await openSandbox();
  await tap(page.getByRole("button", { name: /^Mia and Jules's family/ }));
  await expect(page).toHaveURL(/\/$/);

  screen("More");
  await tap(page.getByRole("navigation", { name: "Family tabs" }).getByRole("link", { name: "More" }));
  await tap(page.getByRole("link", { name: /^Bills/ }));

  screen("Bills");
  await expect(page).toHaveURL(/\/more\/bills$/);
  const months = page.getByTestId("month-bill");
  await expect(months.first()).toBeVisible();
  expect(await months.count()).toBeGreaterThanOrEqual(1);
  await expect(page.getByText("Sample bills, worked out from your lesson dates. Nothing is ever charged in the sample.")).toBeVisible();
  // Both prices on every line, bank draft first.
  for (const prices of await page.getByTestId("line-prices").allInnerTexts()) {
    const flat = prices.replace(/\s+/g, " ");
    expect(flat.indexOf("Bank draft")).toBeGreaterThanOrEqual(0);
    expect(flat.indexOf("Bank draft")).toBeLessThan(flat.indexOf("Card"));
  }
  const lines = page.getByTestId("bill-line");
  await expect(lines.filter({ hasText: "Mia" }).first()).toBeVisible();
  await expect(lines.filter({ hasText: "Jules" }).first()).toBeVisible();
  await expect(months.first().getByTestId("you-pay")).toContainText("by bank draft");
  const text = await page.locator("main").innerText();
  if (/November/.test(await months.first().innerText())) {
    await expect(page.getByTestId("not-billed").filter({ hasText: /^November\s29: Closed for the holiday weekend \(sample\)\. Not billed\.$/ }).first()).toBeVisible();
  }
  expect(text).not.toMatch(/\bfees?\b|surcharge/i);
  await check("bills");
  run!.notes.push("Every bill line shows the bank draft price, then the card price; closed days are listed and not billed.");

  screen("Messages");
  await page.goBack();
  await tap(page.getByRole("link", { name: /^Messages/ }));
  await expect(page.getByText("Send a ready-made note, like \"We'll miss Sunday,\" and we'll take it from there. A person reads every note.")).toBeVisible();
  await check("messages-empty");
  await tap(page.getByRole("button", { name: "Send a note" }));

  screen("Send a note: what it's about");
  await expect(page).toHaveURL(/\/more\/messages\/new$/);
  await expect(page.locator("main textarea, main input[type=text]")).toHaveCount(0);
  await check("note-kind");
  await tap(page.getByRole("button", { name: /^We'll miss a lesson/ }));

  screen("Send a note: which swimmer");
  await tap(page.getByRole("button", { name: /^Mia$/ }));

  screen("Send a note: which lesson");
  await expect(page.getByRole("heading", { name: "Which lesson will Mia miss?" })).toBeVisible();
  await check("note-date");
  const pick = page.locator('[data-testid^="miss-"]').first();
  const pickedDate = (await pick.locator("span").first().innerText()).trim();
  await tap(pick);

  screen("Send a note: your note");
  await expect(page.getByTestId("note-preview")).toHaveText(new RegExp(`^We'll miss Mia's lesson on ${pickedDate.replace(/\s/g, "\\s")}\\.$`));
  await check("note-preview");
  const notesBefore = (await stored()).familyNotes.length;
  await tap(page.getByRole("button", { name: "Send this note" }));

  screen("Messages after sending");
  await expect(page).toHaveURL(/\/more\/messages\?sent=1$/);
  await expect(page.getByText("Sent. A person at the school reads every note.")).toBeVisible();
  await expect(page.getByTestId("family-note").first()).toContainText("Waiting for a person to read it.");
  expect((await stored()).familyNotes.length).toBe(notesBefore + 1);
  await check("messages-sent");

  screen("Lesson dates");
  await tap(page.getByRole("navigation", { name: "Family tabs" }).getByRole("link", { name: "More" }));
  await tap(page.getByRole("link", { name: /^Lesson dates/ }));
  await expect(page.getByTestId("missing-day")).toHaveCount(1);
  await expect(page.getByTestId("missing-day")).toContainText("You sent a note that Mia will miss it.");
  await check("lesson-dates-missing");
  run!.notes.push(`Mia's note for ${pickedDate} was saved with the app's own words; no text box anywhere; Lesson dates mark the day Missing.`);
  run!.passed = true;
});

test("walk-through 9: the owner's approvals inbox, a talk, a note and a waitlist offer", async () => {
  begin(9, "As the owner: talk with Ada's family, read Mia's note, offer the spot a family left, and Ada's family says yes");
  screen("Sandbox: play as the owner");
  await page.goto("/");
  await openSandbox();
  await tap(page.getByRole("button", { name: /^Owner/ }));

  screen("Inbox");
  await expect(page).toHaveURL(/\/owner\/inbox$/);
  await expect(page.getByRole("navigation", { name: "Owner tabs" }).getByRole("link", { name: "Inbox" })).toHaveAttribute("aria-current", "page");
  const talk = page.getByTestId("inbox-talk").filter({ hasText: "Ada" });
  await expect(talk).toContainText("A yes on the custody question.");
  await check("inbox", { family: false });
  await tap(talk.getByRole("button", { name: "We've talked with the family" }));
  await expect(page.getByTestId("inbox-talk").filter({ hasText: "Ada" })).toHaveCount(0);
  const note = page.getByTestId("inbox-note").filter({ hasText: "We'll miss Mia's lesson" });
  await tap(note.getByRole("button", { name: "Mark as read" }));
  await expect(page.getByTestId("inbox-note")).toHaveCount(0);
  const ada = page.getByTestId("inbox-waitlist").filter({ hasText: "Ada" });
  await expect(ada).toContainText("Waiting for the Sunday 9:00");
  await expect(ada).toContainText("No spot that fits is open yet.");
  const data = await stored();
  const adaRow = data.children.find((c: { firstName: string }) => c.firstName === "Ada");
  expect(adaRow.flaggedForPerson).toBe(false);
  expect(data.talkRecords).toHaveLength(1);
  run!.notes.push("The talk with Ada's family was recorded and her flag cleared; Mia's note was marked read.");

  screen("Sandbox: Pretend a family left a full class");
  await openSandbox();
  await tap(page.getByRole("button", { name: "Pretend a family left a full class" }));
  await expect(page).toHaveURL(/\/owner\/inbox$/);

  screen("Inbox: offer the spot");
  const open = page.getByTestId("inbox-waitlist").filter({ hasText: "Ada" });
  await expect(open).toContainText(/A spot is open in the Sunday 9:00\sam class, with Coach Wren\./);
  await expect(open.getByTestId("draft")).toHaveCount(0);
  await tap(open.getByRole("button", { name: /^In place of the Sunday 10:00\sam class/ }));
  await expect(open.getByTestId("draft-words")).toContainText(/Would you like Ada to move there from the Sunday 10:00\sam class\?/);
  await check("inbox-draft", { family: false });
  await tap(open.getByRole("button", { name: "Send the offer (sample)" }));
  await expect(page.getByTestId("inbox-waitlist").filter({ hasText: "Ada" }).getByTestId("inbox-waiting")).toContainText("Offer sent.");
  expect((await stored()).waitlistOffers).toHaveLength(1);
  run!.notes.push("A sample family left the full 9:00 class; a person chose to offer it in place of Ada's 10:00 class and saw the drafted words before sending.");

  screen("Sandbox: play as Leo and Ada's family");
  await openSandbox();
  await tap(page.getByRole("button", { name: /^Leo and Ada's family/ }));

  screen("Home: an answer is needed");
  await expect(page.getByTestId("home-needs-answer")).toContainText("A spot opened for Ada.");
  await check("home-needs-answer");
  await tap(page.getByRole("button", { name: "See Ada's spot" }));

  screen("Messages: the offer");
  const offer = page.getByTestId("school-offer");
  await expect(offer.getByTestId("offer-words")).toContainText("A spot opened for Ada in the Sunday 9:00");
  await expect(offer).toContainText("Bank draft");
  await check("messages-offer");
  await tap(offer.getByRole("button", { name: "Yes, book it" }));
  await expect(page.getByTestId("offer-status")).toContainText("You said yes. Ada's first lesson there is");
  const after = await stored();
  const adaClasses = after.enrollments
    .filter((e: { childRecordId: string; endedOn: string | null }) => e.childRecordId === adaRow.id && !e.endedOn)
    .map((e: { timeId: string }) => e.timeId);
  expect(adaClasses).toEqual(["buc-sun-0900-cove"]);
  expect(after.waitlistEntries.filter((w: { childRecordId: string }) => w.childRecordId === adaRow.id)).toHaveLength(0);
  await check("messages-offer-yes");
  run!.notes.push("Ada's family said yes: she moved to the 9:00 class, the 10:00 spot opened, and she left the waitlist.");
  run!.passed = true;
});

test("walk-through 10: a lesson the school cancels, offered again with the same coach", async () => {
  begin(10, "The school cancels a lesson for walk-through 1's family; the owner offers a date with the same coach; the family says yes");
  screen("Sandbox: play as Mia's family");
  await page.goto("/");
  await openSandbox();
  await tap(page.getByRole("button", { name: /^Mia and Jules's family/ }));

  screen("Messages: the note was read");
  await page.goto("/more/messages");
  await expect(page.getByTestId("family-note").first()).toContainText("Read by the school on");

  screen("Sandbox: Pretend the school cancelled a lesson");
  await openSandbox();
  await tap(page.getByRole("button", { name: "Pretend the school cancelled a lesson" }));
  await expect(page).toHaveURL(/\/more\/messages$/);

  screen("Messages: the cancellation");
  const card = page.getByTestId("school-cancelled").first();
  const heading = await card.getByRole("heading").innerText();
  const who = heading.match(/^We cancelled (\w+)'s lesson$/)![1];
  await expect(card.getByTestId("offer-status")).toHaveText("A person at the school is choosing a date with Coach Dev.");
  await check("messages-cancelled");

  screen("Sandbox: play as the owner");
  await openSandbox();
  await tap(page.getByRole("button", { name: /^Owner/ }));

  screen("Inbox: offer a date");
  const owed = page.getByTestId("inbox-owed").filter({ hasText: who }).first();
  await expect(owed).toContainText("Pick one date to offer.");
  await tap(owed.locator('[data-testid^="owed-slot-"]').first());
  await expect(owed.getByTestId("draft-words")).toContainText(`We cancelled ${who}'s lesson on`);
  await expect(owed.getByTestId("draft-words")).toContainText("with Coach Dev at Madison instead. Does that work?");
  await check("inbox-owed", { family: false });
  await tap(owed.getByRole("button", { name: "Send the offer (sample)" }));
  await expect(page.getByTestId("inbox-owed").filter({ hasText: who }).first().getByTestId("inbox-waiting")).toContainText("Waiting for the family's answer by");

  screen("Sandbox: play as Mia's family again");
  await openSandbox();
  await tap(page.getByRole("button", { name: /^Mia and Jules's family/ }));

  screen("Home: an answer is needed");
  await expect(page.getByTestId("home-needs-answer")).toContainText(`A new date for ${who}'s cancelled lesson.`);
  await tap(page.getByRole("button", { name: `See ${who}'s new date` }));

  screen("Messages: say yes");
  const answer = page.getByTestId("school-cancelled").filter({ hasText: `We cancelled ${who}'s lesson` }).first();
  await tap(answer.getByRole("button", { name: "Yes, that works" }));
  await expect(answer.getByTestId("offer-status")).toContainText(`You said yes. ${who}'s lesson is on`);
  await check("messages-owed-yes");

  screen("Lesson dates");
  await tap(page.getByRole("navigation", { name: "Family tabs" }).getByRole("link", { name: "More" }));
  await tap(page.getByRole("link", { name: /^Lesson dates/ }));
  const cancelledDay = page.getByTestId("lesson-dates").filter({ hasText: who }).getByTestId("cancelled-day").first();
  await expect(cancelledDay).toContainText(/Its new date is \w+day, \w+\s\d+ at \d+:\d\d\s[ap]m with Coach Dev\./);
  await expect(cancelledDay.getByTestId("owed-day")).toContainText("New date");
  await check("lesson-dates-owed");

  screen("Bills");
  await page.goto("/more/bills");
  await expect(page.getByTestId("cancelled-billed").first()).toContainText("we cancelled this lesson. Its new date is");
  await check("bills-owed");
  const data = await stored();
  const booked = data.owedLessons.filter((o: { offers: { answer: string | null }[] }) => o.offers.some((x) => x.answer === "yes"));
  expect(booked).toHaveLength(1);
  run!.notes.push(`The school cancelled ${who}'s lesson; a person offered one date with Coach Dev; the family said yes; Lesson dates and Bills show the new date.`);

  // The same class date was cancelled for walk-through 5's Noa too: every child in the class is owed the lesson.
  screen("Sandbox: play as the owner for Noa");
  await openSandbox();
  await tap(page.getByRole("button", { name: /^Owner/ }));
  screen("Inbox: offer Noa a date");
  const noa = page.getByTestId("inbox-owed").filter({ hasText: "Noa" }).first();
  await expect(noa).toContainText("Pick one date to offer.");
  await tap(noa.locator('[data-testid^="owed-slot-"]').first());
  await tap(noa.getByRole("button", { name: "Send the offer (sample)" }));
  await expect(page.getByTestId("inbox-owed").filter({ hasText: "Noa" }).first().getByTestId("inbox-waiting")).toBeVisible();
  screen("Sandbox: play as Noa's family");
  await openSandbox();
  await tap(page.getByRole("button", { name: /^Noa's family/ }));
  screen("Home: Noa's answer");
  await tap(page.getByRole("button", { name: "See Noa's new date" }));
  screen("Messages: Noa says yes");
  await tap(page.getByTestId("school-cancelled").first().getByRole("button", { name: "Yes, that works" }));
  await expect(page.getByTestId("school-cancelled").first().getByTestId("offer-status")).toContainText("You said yes. Noa's lesson is on");
  screen("Lesson dates: Noa's new date");
  await tap(page.getByRole("navigation", { name: "Family tabs" }).getByRole("link", { name: "More" }));
  await tap(page.getByRole("link", { name: /^Lesson dates/ }));
  const noaDay = page.getByTestId("cancelled-day").first();
  await expect(noaDay).toContainText(/Its new date is \w+day, \w+\s\d+ at \d+:\d\d\s[ap]m with Coach Dev\./);
  await expect(noaDay.getByTestId("owed-day")).toContainText("New date");
  await check("lesson-dates-noa");
  run!.notes.push("Walk-through 5's Noa, in the same cancelled class, was owed the lesson too; a person offered her a date and she said yes. Home still shows her next weekly lesson, which comes first.");
  run!.passed = true;
});

test("walk-through 11: join a waitlist for another class, then leave it", async () => {
  begin(11, "Walk-through 1's family puts Mia on the waitlist for a full class, then takes her off it from Home");
  screen("Sandbox: play as Mia's family");
  await page.goto("/");
  await openSandbox();
  await tap(page.getByRole("button", { name: /^Mia and Jules's family/ }));

  screen("Home");
  await tap(page.getByTestId("add-child-card").getByRole("button", { name: "Add a child or a class" }));
  screen("Add a child or a class");
  await tap(page.getByRole("button", { name: "Another class for Mia" }));

  screen("1 Pick a time");
  const full = page.getByTestId("time-mad-wed-1630-shallows");
  await expect(full).toContainText("Full");
  await tap(full.getByRole("button", { name: "Join the waitlist" }));
  await check("add-waitlist-times");
  await tap(page.getByRole("button", { name: "Continue with the waitlist only" }));

  screen("2 Check and join");
  await expect(page.getByText(/On the waitlist for Wednesdays at 4:30\spm/)).toBeVisible();
  await check("add-waitlist-review");
  await tap(page.getByRole("button", { name: "Join the waitlist" }));

  screen("On the waitlist");
  await expect(page).toHaveURL(/\/family\/add\/done$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mia is on the waitlist");
  await check("add-waitlist-done");
  await tap(page.getByRole("button", { name: "Go to Home" }));

  screen("Home: leave the waitlist");
  const mia = page.getByTestId("home-child").filter({ hasText: "Mia" });
  const line = mia.getByTestId("home-waitlist");
  await expect(line).toContainText(/On the waitlist for Wednesdays at 4:30\spm\./);
  await tap(line.getByRole("button", { name: "Leave this waitlist" }));
  await expect(line).toContainText(/Take Mia off the waitlist for Wednesdays at 4:30\spm\?/);
  await check("home-leave-waitlist");
  await tap(line.getByRole("button", { name: "Leave the waitlist" }));
  await expect(mia.getByTestId("home-waitlist")).toHaveCount(0);
  const data = await stored();
  const miaRow = data.children.find((c: { firstName: string }) => c.firstName === "Mia");
  expect(data.waitlistEntries.filter((w: { childRecordId: string }) => w.childRecordId === miaRow.id)).toHaveLength(0);
  run!.notes.push("Mia joined the waitlist for the full Wednesday 4:30 class (the done screen says so, not an earlier class), then the family took her off it from Home.");
  run!.passed = true;
});

test("walk-through 12: a fill-in for a lesson the family will miss", async () => {
  begin(12, "Walk-through 1's family says Mia will miss a lesson; the owner offers one fill-in with the same coach the week after; the family says yes");
  screen("Sandbox: play as Mia's family");
  await page.goto("/");
  await openSandbox();
  await tap(page.getByRole("button", { name: /^Mia and Jules's family/ }));

  screen("Send a note");
  await page.goto("/more/messages/new?kind=miss");
  await tap(page.getByRole("button", { name: /^Mia$/ }));
  screen("Which lesson");
  const pick = page.locator('[data-testid^="miss-"]').first();
  const pickedDate = (await pick.locator("span").first().innerText()).trim();
  await tap(pick);
  screen("Your note");
  await tap(page.getByRole("button", { name: "Send this note" }));
  await expect(page.getByText("Sent. A person at the school reads every note.")).toBeVisible();

  screen("Sandbox: play as the owner");
  await openSandbox();
  await tap(page.getByRole("button", { name: /^Owner/ }));

  screen("Inbox: offer a fill-in");
  const note = page.getByTestId("inbox-note").filter({ hasText: `We'll miss Mia's lesson on ${pickedDate}` });
  await expect(note).toContainText(/A fill-in: one date with Coach \w+ the week after\. Pick one, or none\./);
  await tap(note.locator('[data-testid^="fill-in-slot-"]').first());
  await expect(note.getByTestId("draft-words")).toContainText(`You told us Mia will miss ${pickedDate}. We can offer a fill-in on`);
  await check("inbox-fill-in", { family: false });
  const fillInsBefore = (await stored()).fillIns.length;
  await tap(note.getByRole("button", { name: "Send the fill-in (sample)" }));
  await expect(page.getByTestId("inbox-note").filter({ hasText: `We'll miss Mia's lesson on ${pickedDate}` })).toHaveCount(0);
  expect((await stored()).fillIns.length).toBe(fillInsBefore + 1);

  screen("Sandbox: play as Mia's family again");
  await openSandbox();
  await tap(page.getByRole("button", { name: /^Mia and Jules's family/ }));

  screen("Home: an answer is needed");
  await expect(page.getByTestId("home-needs-answer")).toContainText("A fill-in for Mia's missed lesson.");
  await check("home-fill-in");
  await tap(page.getByRole("button", { name: "See Mia's fill-in" }));

  screen("Messages: say yes");
  const card = page.getByTestId("school-fill-in").first();
  await expect(card.getByTestId("offer-words")).toContainText(`You told us Mia will miss ${pickedDate}.`);
  await check("messages-fill-in");
  await tap(card.getByRole("button", { name: "Yes, that works" }));
  await expect(card.getByTestId("offer-status")).toContainText("You said yes. Mia's fill-in is on");

  screen("Lesson dates");
  await tap(page.getByRole("navigation", { name: "Family tabs" }).getByRole("link", { name: "More" }));
  await tap(page.getByRole("link", { name: /^Lesson dates/ }));
  const missed = page.getByTestId("missing-day").filter({ hasText: pickedDate });
  await expect(missed).toContainText("Mia's fill-in is just below.");
  await expect(missed.getByTestId("fill-in-day")).toContainText("Fill-in");
  await check("lesson-dates-fill-in");
  const data = await stored();
  expect(data.fillIns.filter((f: { offer: { answer: string | null } }) => f.offer.answer === "yes")).toHaveLength(1);
  run!.notes.push(`Mia's family said she'll miss ${pickedDate}; a person offered one fill-in with the same coach the week after; the family said yes; Lesson dates show it under the missed day.`);
  run!.passed = true;
});
