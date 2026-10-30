# Decisions

Where the brief left room, or a step needed a fix, the choice is written here: the choice, why, and how to change it.

## Setup

1. **Repo and pushing.** The first session (another account) couldn't push to swim-a11y/popsicle-pier-app, so its setup commit was lost and this session redid setup from the handoff file in Drive. This session pushes to main with `git push origin HEAD:main`. *Change:* if pushing to main is ever refused, keep working on the session branch and open one pull request into main.
2. **shadcn parts written by hand.** `npx shadcn@latest init` failed here: the network policy blocks ui.shadcn.com ("Request was cancelled"). The nine parts (button, input, checkbox, radio-group, label, card, dialog, sheet, field) are written in `src/components/ui/` in the shadcn pattern, on the packages shadcn itself uses: @radix-ui/react-slot, -checkbox, -radio-group, -label, -dialog, class-variance-authority, clsx, tailwind-merge, lucide-react, and tw-animate-css (dev). Field draws its separator inline so no tenth part is needed. They use token classes only. *Change:* where the registry is reachable, `npx shadcn@latest add <part> --overwrite` and re-point any colors at tokens.
3. **Playwright pinned to 1.63.0.** The cloud container ships Chromium for Playwright 1.63.0 in /opt/pw-browsers (PLAYWRIGHT_BROWSERS_PATH) and says not to run `playwright install`, so `@playwright/test` is pinned to exactly 1.63.0 and no executablePath is needed. *Change:* on another machine, bump the version and run `npx playwright install --with-deps chromium`.
4. **playwright-core override.** `@axe-core/playwright` pulls the newest playwright-core as a peer, whose Page type clashes with 1.63 and breaks `next build`'s typecheck. package.json has `"overrides": { "playwright-core": "1.63.0" }`. *Change:* keep it equal to the @playwright/test version.
5. **@types/node ^22.** Vitest 5 needs it (create-next-app pins ^20, which fails on peers). It also matches engines.node 22.x.
6. **e2e/screens.spec.ts fix.** The brief's copy lost the backticks around three template strings (the test name, the screenshot path and the violation label), so the file couldn't parse. The only change is putting those backticks back.
7. **Telemetry.** `process.env.NEXT_TELEMETRY_DISABLED = "1"` at the top of next.config.ts (Next reads it after loading the config) plus `npx next telemetry disable`.
8. **Tailwind through Turbopack.** create-next-app 16.4.3 wires Tailwind with a Turbopack CSS rule (`@tailwindcss/turbopack`) instead of PostCSS. Kept as generated; `cacheComponents` set to false and `partialPrefetching` removed, as the brief asks.
9. **Extra scripts.** `typecheck` (tsc --noEmit) and `lint` (eslint) next to `test` and `e2e`, so the stop hook and humans run the same checks.
10. **Other packages.** Only what the brief lists, the shadcn parts' own packages (decision 2), and `@testing-library/dom`, which npm adds as the required peer of @testing-library/react. Nothing else.
11. **create-next-app files removed.** The Next and Vercel SVGs and favicon.ico are deleted (no logo image); public/robots.txt disallows all.

## Plan decisions (approved by the owner before setup)

1. **Static routes.** /sign-up/pool through /sign-up/release; steps that repeat per child use ?child=2; You're in is /sign-up/youre-in; moving over is /move-over/...; owner /owner/releases; staff /staff; Bills and Messages /more/bills and /more/messages. The query is read in an effect, never during render. *Change:* src/screens.ts and the folders in src/app.
2. **Lesson dates from a rule.** Seeds hold weekly classes, not dated rows. The first lesson is the first class day at least 2 days after today, and Buckhead never before 2026-11-08 (`opensOn` on the pool). *Change:* `firstLessonDate` in src/rules/dates.ts and `opensOn` in the pool seeds.
3. **Prices live on the lesson type at each pool** (private, semi-private). The card price is the bank price times 1.03, rounded down to a quarter, so it never goes over 3 percent. *Change:* `cardPriceCents` in src/rules/prices.ts.
4. **Which times fit.** Private times fit any stage; semi-private times must match the child's stage and age; under 3 sees only private times with a parent in the water. *Change:* src/rules/times.ts.
5. **Too young.** The times step says the date the child can start; at Buckhead it also offers Madison, which starts at 2. *Change:* the too-young block in the times step.
6. **Step 5 opens up as you go:** details, then "Send my code", then the code (checks itself at 6 digits), then the how-you-heard tap moves on.
7. **Fill in a sample family** fills every typed field (one child aged 4, you, the code, emergency contacts, the signing name); every choice is still a tap. *Change:* src/sandbox/sample-fill.ts.
8. **Full times** show "Full" with a separate "Join the waitlist" button; the waitlist entry saves when the family signs and saves.
9. **One tap links a sample bank or card** (SANDBOX-REF-000N from one counter); the backup card is required only with bank draft.
10. **Fingerprint** is SHA-256 of the exact release text shown, names and per-child questions included. It uses a small built-in SHA-256 (checked against the standard test vectors) so it works on a phone over plain http, where Web Crypto is missing; randomUUID has a getRandomValues fallback for the same reason.
11. **Several sample families per phone.** The New parent line in the Sandbox sheet lists the families signed up on this phone and switches between them, so walk-through 6 can go back to families 1 and 2.
12. **Pretend the first lesson** names the parent on deck; the rule accepts a Signed listed adult and refuses a Waiting one.
13. **"After the first lesson"** means an attendance mark exists, not that the date has passed.
14. **Banner:** a sticky navy bar at the top, white 14px text so it fits three lines at 375px; tab labels are also 14px; everything else is 17px or larger. The wordmark and the pill sit under it on cream.
15. **One neutral line color** (#647A8F, `--color-line`) is added so form borders reach 3:1 on every background. No other color is added.
16. **Release v1 has seven groups;** v2 adds "AI review and our tools" and the underwater choice, and the recording group gains adults on deck and in the water.
17. **Child ID counter** starts after the seeded children (the moving-over children hold PP24 and PP25 IDs, other sample families the serials between), so the first new child is PP26-0042.
18. **Playwright** pinned to the container's browser version (setup decision 3).
19. **Clean room:** the "popsicle-pier-front-desk" and "swim-school-consultant" skills listed in the session are never opened.
20. **Payment settings** (src/config.ts): see below.

## Payment settings

- **cardPricing: "card price".** Bank draft has the lower price and the card its own higher one (about 3 percent more, rounded down to a quarter). The other mode, "card fee" (one price plus a fee on cards), is built in the rule function and tested but never shown. *Change:* `cardPricing` in src/config.ts. A card fee can never apply to debit cards.
- **evaluationAsksForCard: true.** Booking only the free evaluation asks for a card to hold the spot; it is never charged. *Change:* `evaluationAsksForCard` in src/config.ts; when false, a family booking only evaluations skips the payment step.
