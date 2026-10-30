import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/*
  The looks a parent meets when something needs fixing or nothing fits:
  missing answers, a code that doesn't match, nothing open, and a release
  sent with boxes unchecked. Each one is captured and checked with axe.
*/

async function capture(page: Page, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `screenshots/state-${name}.png`, fullPage: true });
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${name}: ${v.id}: ${v.help}`)).toEqual([]);
}

test("missing answers, a wrong code, nothing open and an unfinished release", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: /^Buckhead/ }).click();

  // Continue with nothing typed: what to fix shows next to each field.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Please type a first name.")).toBeVisible();
  await expect(page.getByText("Please type the month, day and year.")).toBeVisible();
  await capture(page, "swimmers-missing");

  const d = new Date();
  d.setFullYear(d.getFullYear() - 8);
  await page.getByLabel("First name").fill("Wren");
  await page.getByLabel("Month").fill(String(d.getMonth() + 1));
  await page.getByLabel("Day").fill(String(d.getDate()));
  await page.getByLabel("Year").fill(String(d.getFullYear()));
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /^Open Water/ }).click();

  // Nothing open fits: the waitlist or the free evaluation.
  await expect(page.getByTestId("nothing-fits")).toContainText("Nothing open fits Wren at Buckhead right now.");
  await expect(page.getByRole("heading", { name: "Or start with a free evaluation" })).toBeVisible();
  await capture(page, "nothing-fits");
  await page.getByTestId("nothing-fits").getByRole("button", { name: "Join the waitlist" }).click();
  await page.getByRole("button", { name: "Continue with the waitlist only" }).click();

  // Emails and phones must be made up.
  await page.getByLabel("Your name").fill("Pat Example");
  await page.getByLabel("Email").fill("pat@mail.test");
  await page.getByLabel("Phone").fill("404-123-4567");
  await page.getByRole("button", { name: "Send my code" }).click();
  await expect(page.getByText("Please use a made-up email that ends in @example.com.")).toBeVisible();
  await expect(page.getByText("Please use a made-up number with 555 in the middle, like 404-555-0123.")).toBeVisible();
  await capture(page, "you-made-up-only");

  // A code that doesn't match.
  await page.getByLabel("Email").fill("pat.example@example.com");
  await page.getByLabel("Phone").fill("404-555-0190");
  await page.getByRole("button", { name: "Send my code" }).click();
  await page.getByLabel("6-digit code").fill("123456");
  await expect(page.getByText("That code doesn't match. Check the sample code above and try again.")).toBeVisible();
  await capture(page, "wrong-code");
  await page.getByLabel("6-digit code").fill("246810");
  await page.getByRole("button", { name: "Other" }).click();

  await page.getByLabel("Contact 1 name").fill("Lou Example");
  await page.getByLabel("Contact 1 phone").fill("404-555-0191");
  await page.getByLabel("Contact 2 name").fill("Max Example");
  await page.getByLabel("Contact 2 phone").fill("404-555-0192");
  await page.getByRole("button", { name: "Skip and continue" }).click();
  await page.getByRole("button", { name: "Just me for now" }).click();

  // Only a waitlist: nothing to pay, so the payment step is skipped.
  await expect(page).toHaveURL(/\/sign-up\/release$/);
  await expect(page.getByTestId("step-count")).toHaveText("Step 8 of 8");

  // Sign with boxes unchecked: the release says what's missing and nothing saves.
  await page.getByRole("button", { name: "Sign and save my spot" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Please check the box" })).toContainText('Please check the box for "Staying at the pool".');
  await expect(page).toHaveURL(/\/sign-up\/release$/);
  await capture(page, "release-unfinished");
});
