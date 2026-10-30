import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { SCREENS } from '../src/screens'; // every role's screens: { id, path }

for (const s of SCREENS) {
  test(`${s.id} renders, passes accessibility, and is captured`, async ({ page }, info) => {
    await page.goto(s.path);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `screenshots/${info.project.name}-${s.id}.png`, fullPage: true });
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map(v => `${v.id}: ${v.help}`)).toEqual([]);
  });
}
