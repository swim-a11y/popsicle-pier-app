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

## Made while building

21. **At a glance on "Your first lesson".** Each pool has two short SAMPLE lines (`firstLesson.atAGlance`: park, bring) shown with "Stays" right under the lesson ticket, so where to park, what to bring and who stays fit above the tab bar on a 375x667 phone (walk-through 6 checks the box's bottom edge). The full SAMPLE details follow below. *Change:* the pool seeds in src/sandbox/seed.ts.
22. **Seeded sample families.** Four made-up families signed v1 or v2 earlier, so the owner's counts aren't all zero and the full classes' spots belong to someone. Their child ID serials leave gaps (children who left); gaps are never reused, and the next new child is PP26-0042. *Change:* `buildSeed`.
23. **Booking an open semi-private spot is the family's choice of a listed time.** The app never pairs, suggests or confirms a partner, and it doesn't edit the other child's enrollment; staff confirm partners in a later room. A child booking an empty semi-private time alone gets `unpairedSince` set to the first lesson date; two siblings booking the same time are each other's partner. Prices come from the lesson type only. *Change:* `signAndSave` in src/rules/booking.ts.
24. **Two kinds of waitlist entry.** A full class's waitlist (its class id), or "any time that fits" at the pool (`classId: null`) when nothing fits or the child is too young. Joining never books or invites; the words say someone from the school will reach out. *Change:* src/components/screens/sign-up/times.tsx.
25. **Next lesson, not first, when lessons have already happened.** The family moving over (lessons since 2024 and 2025), and any family after "Pretend the first lesson happened", see "Your next lesson": the class's next date after today and after any lesson already marked. *Change:* `upcomingLessonDate` in src/rules/family.ts.
26. **You're in for a free evaluation only** says "Nothing was charged today. The free evaluation is never charged." in place of the first-bill line, since no bill follows an evaluation.
27. **Release words.** Each of the eight groups has its own one-sentence box ("I understand every lesson is recorded." and so on). The release's research choice is the only place the word research appears; group c and e say "a study" and "study use". Lesson video "never goes on personal phones or accounts" reads as "Our staff never keep lesson video on personal phones or accounts", since a family may keep a copy it downloads. *Change:* src/content/release.ts (a change to published text means a new version and fingerprint).
28. **No old-system name for families.** Moving over says "Bank details don't move to the new app, so please link your bank again"; the old product is never named on a family screen. Until the old provider answers in writing, every family relinks its bank.
29. **Keeping their place.** The draft saves when a step moves on, and each typed field saves when it loses focus, so Back (one step, from the computed step list) and closing the tab lose nothing. The start screen's "Pick up where you left off" goes to the draft's last step. *Change:* src/components/screens/sign-up/shared.tsx.
30. **Sample fill and the code.** "Fill in a sample family" also fills the code box, so tapping "Send my code" confirms the email at once when the filled code matches. Every choice is still a tap.
31. **Pretend the first lesson for a free evaluation** uses a separate set of three evaluation coach lines and shows "free evaluation" where the stage would be, since the stage is set after the evaluation.
32. **Banner height.** At 375px the 14px banner wraps to four lines, not the three planned. It stays sticky (always visible); content and the fixed tab bar work around it. *Change:* src/components/shell/sample-banner.tsx and `--text-small` in tokens.css.
33. **Render tests mock Next.** Each render test file mocks next/navigation and next/link at its top level (vitest.config.ts stays exactly as given). Screens read the store through `getStore()`, which tests replace with a seeded in-memory store.
34. **Checker agents as general-purpose subagents.** The design-critic and rules-checker agents in .claude/agents weren't loaded in this session (the session started before they existed), so each ran as a general-purpose subagent with its file's text as the instructions, as the brief allows.

## From the first agent round

35. **Bookings are re-checked at sign and save.** A booked time must still fit the child (age on its first lesson date, stage, pool, under 3 private only); if not, sign-up sends the parent back to that child's times. Changing a birth date on Your swimmers, or the Sandbox fill changing one, clears that child's time and waitlist so they pick again. *Change:* `bookingStillFits` in src/rules/booking.ts.
36. **One child per free evaluation.** Each evaluation time holds one child, so an under-3 is never in a shared one (Madison gained a second Sunday time). *Change:* the evaluation seeds.
37. **The pool's email where a screen says to email us.** The bank-draft authorization's cancel line and the release's research line name the pool's school email in plain text, and those exact words are what's stored and hashed. Release v2's research line changed during the build for this, so its fingerprint was re-pasted; v1 keeps its old words and fingerprint. Before a real release is published, its text is final. *Change:* `bankDraftLines` in src/content/payment.ts, `researchV2` in src/content/release.ts.
38. **Moving over signs with "Sign and save my spot"**, the brief's step 9 button, so both paths end the same way.
39. **"No partner yet" shows only while it's true.** It needs the enrollment's unpaired date and a class holding no one else; reading it never edits the enrollment. *Change:* `stillUnpaired` in src/rules/family.ts.
40. **A changed seedVersion wipes signatures too.** That is the brief's reseed rule, and like the Sandbox erase it only exists in the sandbox; the app itself never edits or deletes a signature, coverage, consent or authorization.
41. **Kept as the brief has them, after the design critic's notes.** The release's typed full name isn't filled in from step 5, because typing it is the act of signing. Your people keeps "Skip and continue" for the brief's "or Skip".
42. **Who stays leads with "Just me for now".** The primary button sits under the no-drop-off words; adding another adult (one tap for anyone from step 6, or typed) follows under "Another adult staying too?".

## From the final agent round

43. **Home's next-lesson card gives each child their own time and coach.** When two children have lessons on the same day it shows the date once and one line per child, soonest first (the design critic's blocker: one time for both would have sent Juniper 30 minutes late). *Change:* src/components/screens/home.tsx.
44. **One price layout everywhere.** Times, Home and moving over all show "Bank draft $34.00 a lesson" over "Card $35.00 a lesson" (src/components/parts/price-rows.tsx), and clock times keep "9:00 am" on one line.
45. **A release sent with something missing** scrolls to and focuses the first missing answer, marks each unchecked group with "Please check this box.", and counts what's left with a button to go there.
46. **You're in with two or more children** puts "See your first lesson" right under the summary line, above the children's cards.
47. **Times stay in time order.** The critic suggested listing open times before full ones; they stay in order so a family sees its first choice where it expects it (walk-through 2's first choice is the Full 9:00 class). The Full tag now sits under the time instead of beside it.
48. **A child only on a waitlist has no child ID at signing.** IDs come with the first booking (the brief), so the signature lists the IDs of booked children; a waitlisted child gets one when a person books them, and the signature, being add-only, isn't changed.
49. **Messages keeps the brief's own line**, "Tell us in a sentence, like 'We'll miss Sunday,' and we'll take it from there. A person checks every reply.", as part of the coming-next screen; nothing behind it is built.
50. **Append-only rows are frozen in memory** as well as guarded: signatures, coverage, consents and bank-draft authorizations can't be changed in place through a returned row, inside or outside a transaction.
51. **Error screens keep the sample banner.** `src/app/error.tsx` renders inside the root layout; `src/app/global-error.tsx`, which replaces the layout, brings its own banner and noindex.
52. **Moving over signs once.** Finishing again (say, by revisiting the steps) is refused, so there's never a second signature or authorization for the same move.

## Next phase (after the first build)

The owner asked to keep building with best judgement. The HARD RULES still hold (parent screens only, sandbox only, no staff screens), so this phase fills the parent's side of the next rooms.

53. **Closed days, the parent's side of the Schedule room.** A `Closure` record (pool, date, reason) set by a person; the sample seeds a few holiday and winter-break days per pool, each marked "(sample)". A first lesson never lands on a closed day (`firstOpenLessonDate`), "Your next lesson" skips them, and Lesson dates (under More) lists each swimmer's next weeks (six; see 63) with closed days marked "No lesson, and it isn't billed." Nothing is promised in their place: the rule that closed days aren't made up stays with the school. *Change:* the closure seeds in src/sandbox/seed.ts and src/rules/closures.ts.
54. **One booking helper.** Sign-up and adding a child or a class both book through `bookTime` in src/rules/booking.ts (ID on first booking, first open lesson date, one spot taken).
55. **Add a child or a class is built** (it was a coming-next card on Home in the first build, so that card's render test now checks for the button that opens the flow). It lives at /family/add with its own draft (`AddDraft`), so a half-finished addition picks up where it left off.
56. **Adding a child still asks that child's two yes or no questions and three choices.** "Signs nothing" means no new signature: the answers go on the new coverage row (and each choice is its own consent row under the family's signature), so a custody or health yes still flags the child for a person before the first lesson. *Change:* `commitAdd` in src/rules/add.ts.
57. **A family on an older release** signs the current version once for everyone when it adds a child (the release form takes the place of the two questions). Adding a class for a child already covered asks for no signature.
58. **Another class** never offers the child's own class, or a time within the same half hour on the same weekday at either pool, and offers a free evaluation only to a child whose stage isn't set yet. *Change:* `addTimes` in src/rules/add.ts.
59. **One more sample class:** a semi-private Shallows class at Buckhead on Wednesdays at 4:00 pm, so a child can take a second class at the other pool (walk-through 7). That makes ten classes.
60. **The add done screen** has its own address and reads the newest addition from stored data, so a refresh never adds twice; a first lesson at a pool the family hasn't used yet shows that pool's SAMPLE directions.
61. **A family with lessons at both pools** sees each pool's own at-a-glance box, directions and things to bring on Your first lesson, and on Your first lesson and Lesson dates an email line per pool ("Need to miss, move or stop a Buckhead lesson? Email us at ..."), so a miss goes to the right pool. One pool keeps the brief's exact line.
62. **Dates keep the month and day together** (a non-breaking space), so a long date breaks after the weekday, never as a lone "1" or "11".
63. **Lesson dates is plain rows**: the time sits in each swimmer's card header, not on every row, and what a closed day means is said once above the dates; six weeks ahead.
64. **Paying for lessons comes before adding a class.** A family whose only booking is a free evaluation has a card that only holds that spot, not a way to pay for lessons. In Add a child or a class its class times show but can't be picked, with "To add a class, a person sets up how you'll pay for lessons first. Email us at ..."; the waitlist and free evaluations stay open. This matches staff placing a child after an evaluation. *Change:* `hasLessonPayment` in src/rules/family.ts.
65. **A sibling's saved booking holds its own spot.** Lessons already booked count once (their spot is already taken), and "Next to [name]'s lesson" only marks times at the same pool. *Change:* `holdsSpot` on `SiblingPick` in src/rules/times.ts.
66. **Each child's next lesson comes from all their classes**, on Home, Your first lesson and Progress; Your first lesson shows directions for every pool where a first visit is still to come, and works out "Stays" for the children at each pool.
67. **The add flow's questions are marked SAMPLE**, like the release they come from.

## Owner rulings (October 30, 2026)

The owner answered three questions after the first build. The rulings and the options' exact words are in CLAUDE.md under "Owner rulings after the brief"; they change the brief only where they say so.

68. **One approvals inbox, bills for lessons only, tap-to-send notes.** The inbox at `/owner/inbox` is the one exception to "Build no office, instructor, site lead or reviewer screens"; a person makes every choice in it. Bills charge each month's lessons at the lesson price with no fees until the owner sets the amounts. Messages has ready-made notes only, with no free text. The staff page now marks which of its later-room rules these three follow. *Change:* ask the owner; the rulings section in CLAUDE.md is the source.
