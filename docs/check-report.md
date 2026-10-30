# Check report

## Walk-throughs

<!-- walkthroughs:start -->
<!-- wt-1 -->
### Walk-through 1: New parent, one child (age 4) at Madison, with Fill in a sample family

Run 2026-10-30 18:23 UTC, Playwright at 375x667. Result: **passed**. 13 screens, 27 taps, 0 typed fields.

- One spot gone from Sundays at 10:00 am; one release signature and one bank-draft authorization saved.
- Refreshing You're in booked nothing.

| Screen | Taps | Typed fields |
|---|---|---|
| Start | 0 | 0 |
| Sandbox: Fill in a sample family | 2 | 0 |
| 1 Pool | 1 | 0 |
| 2 Your swimmers | 1 | 0 |
| 3 Stage | 1 | 0 |
| 4 Times | 1 | 0 |
| 5 You and the code | 2 | 0 |
| 6 Your people | 1 | 0 |
| 7 Who stays | 1 | 0 |
| 8 Payment | 4 | 0 |
| 9 Family release | 12 | 0 |
| You're in | 0 | 0 |
| See your first lesson | 1 | 0 |
| **Total** | **27** | **0** |
<!-- /wt-1 -->

<!-- wt-2 -->
### Walk-through 2: Two children at Buckhead (ages 3 and 6) with a grandmother listed

Run 2026-10-30 18:23 UTC, Playwright at 375x667. Result: **passed**. 14 screens, 34 taps, 18 typed fields.

- Closed the tab at Your people; Pick up where you left off came back to Your people.
- One release covers Leo and Ada; Ada is flagged for a person; no Buckhead date before Sunday, November 8, 2026.

| Screen | Taps | Typed fields |
|---|---|---|
| Start | 1 | 0 |
| 1 Pool | 1 | 0 |
| 2 Your swimmers | 2 | 8 |
| 3 Stage for Leo | 1 | 0 |
| 3 Stage for Ada | 1 | 0 |
| 4 Times for Leo | 1 | 0 |
| 4 Times for Ada | 2 | 0 |
| 5 You and the code | 2 | 4 |
| Close the tab and come back | 1 | 0 |
| 6 Your people | 1 | 4 |
| 7 Who stays | 3 | 1 |
| 8 Payment | 4 | 0 |
| 9 Family release | 14 | 1 |
| You're in | 0 | 0 |
| **Total** | **34** | **18** |
<!-- /wt-2 -->

<!-- wt-3 -->
### Walk-through 3: A 2-year-old at Buckhead (told when they can start), then at Madison (private, parent in the water, free evaluation only)

Run 2026-10-30 18:23 UTC, Playwright at 375x667. Result: **passed**. 12 screens, 24 taps, 13 typed fields.

| Screen | Taps | Typed fields |
|---|---|---|
| Start | 1 | 0 |
| 1 Pool | 1 | 0 |
| 2 Your swimmers | 1 | 4 |
| 3 Stage | 1 | 0 |
| 4 Times at Buckhead | 1 | 0 |
| 4 Times at Madison | 1 | 0 |
| 5 You and the code | 2 | 4 |
| 6 Your people | 1 | 4 |
| 7 Who stays | 1 | 0 |
| 8 Payment: evaluation only | 2 | 0 |
| 9 Family release | 12 | 1 |
| You're in | 0 | 0 |
| **Total** | **24** | **13** |
<!-- /wt-3 -->

<!-- wt-4 -->
### Walk-through 4: The family moving over (two children at Madison)

Run 2026-10-30 18:23 UTC, Playwright at 375x667. Result: **passed**. 9 screens, 26 taps, 2 typed fields.

| Screen | Taps | Typed fields |
|---|---|---|
| Sandbox: Family moving over | 2 | 0 |
| Welcome | 1 | 0 |
| 1 Your details | 1 | 0 |
| 2 Your people | 1 | 0 |
| 3 Your classes | 1 | 0 |
| 4 Confirm your email | 2 | 1 |
| 5 Payment | 4 | 0 |
| 6 Family release | 14 | 1 |
| Home | 0 | 0 |
| **Total** | **26** | **2** |
<!-- /wt-4 -->

<!-- wt-5 -->
### Walk-through 5: Cold run: one child at Madison, every field typed (no fill button), paying by card

Run 2026-10-30 18:23 UTC, Playwright at 375x667. Result: **passed**. 11 screens, 23 taps, 13 typed fields.

| Screen | Taps | Typed fields |
|---|---|---|
| Start | 1 | 0 |
| 1 Pool | 1 | 0 |
| 2 Your swimmers | 1 | 4 |
| 3 Stage | 1 | 0 |
| 4 Times | 1 | 0 |
| 5 You and the code | 2 | 4 |
| 6 Your people | 1 | 4 |
| 7 Who stays | 1 | 0 |
| 8 Payment | 2 | 0 |
| 9 Family release | 12 | 1 |
| You're in | 0 | 0 |
| **Total** | **23** | **13** |
<!-- /wt-5 -->

<!-- wt-6 -->
### Walk-through 6: The first Sunday, continuing walk-through 1 (and walk-through 2's family on deck)

Run 2026-10-30 18:23 UTC, Playwright at 375x667. Result: **passed**. 10 screens, 13 taps, 0 typed fields.

- Pressing Pretend the first lesson happened again added nothing.
- Walk-through 2's Waiting grandmother, Rose, was never named as the adult on deck.

| Screen | Taps | Typed fields |
|---|---|---|
| Sandbox: play as Mia's family | 2 | 0 |
| Home before the first lesson | 1 | 0 |
| Your first lesson | 0 | 0 |
| Sandbox: Pretend the first lesson happened | 2 | 0 |
| Home after the first lesson | 1 | 0 |
| Progress: How it went | 0 | 0 |
| Sandbox: press it again | 2 | 0 |
| Sandbox: play as Leo and Ada's family | 2 | 0 |
| Sandbox: Pretend for walk-through 2's family | 2 | 0 |
| Progress for walk-through 2's family | 1 | 0 |
| **Total** | **13** | **0** |
<!-- /wt-6 -->
<!-- walkthroughs:end -->

## Agent rounds

The design-critic and rules-checker agents in `.claude/agents/` weren't loaded in this session, so each ran as a general-purpose subagent with its file's text as its instructions (DECISIONS.md 34).

### Round 1 (after step 4)

**Design critic** (walk-through screenshots 1, 5 and 6, coming-next screens, cold first visits). Its five fixes, worst first, and what was done:

1. Who stays: "Just me for now" sat under ten relationship buttons and a form. Fixed: it's the primary button right under the no-drop-off words; "Another adult staying too?" follows below.
2. You're in: "See your first lesson" was below the first screen. Fixed: it sits right under the lesson card.
3. You: the required how-heard list read like an optional survey. Fixed: a plain label, "Tap one to continue.", and it scrolls into view once the email is confirmed.
4. Payment: choosing bank draft pushed the Card option 800px down. Fixed: both choices show first; the authorization and backup card follow below both.
5. A step opened too early showed a step count and no heading. Fixed: a heading and no step count.

Smaller notes: the swimmer card's label sat on its border (fixed: a heading inside the card); "Skip and continue" kept for the brief's "or Skip"; the release's typed name stays typed, not filled in from step 5, because typing it is signing (DECISIONS.md 41). The release and staff pages were too tall to read as one image, so long pages are now also saved as phone-sized slices (`*-partN.png`), and `e2e/states.spec.ts` captures the error, wrong-code, nothing-fits and unfinished-release looks.

**Rules checker** (code, seeds and screen text against CLAUDE.md). Fails and what was done:

| Rule | Was | Fix |
|---|---|---|
| Under 3 private only; age on the first lesson date | A booking could outlive a changed birth date | Sign and save re-checks every booked time; a changed birth date clears that child's time (`bookingStillFits`, test added) |
| Pool email wherever a screen says to email us | Authorization and research lines said "email us" with no address | Both now name the pool's email in plain text; v2's fingerprint re-pasted |
| SAMPLE marks | At a glance repeated pool notes unmarked | SAMPLE tag added |
| Step 9 button | Moving over said "Sign and finish" | "Sign and save my spot" |
| "No partner yet" only when true | Read a stored date only | Also needs a class holding no one else (`stillUnpaired`) |
| Under 3 never shares | Free evaluations held two | One child per evaluation |
| Approved notes only | The note card had no guard of its own | It returns nothing for a draft note |
| Coverage | Returned undefined for a child already named | Returns null; test added |
| Family words coverage | The scan skipped rules, screens.ts and not-found | Added |

Everything else passed: sandbox and nothing leaving the device, clean room and people choose, family words, release, signature rows and append-only, child IDs, listed adults, payment, ages and stages, no live view, first Sunday.

### Final round (after step 6)

**Design critic.** One blocker, fixed: Home's next-lesson card showed one time and coach for every child on that day, so the moving-over family read 5:00 pm for Juniper, whose class is at 4:30. Home now gives each child their own line ("Juniper, 4:30 pm with Coach Tamsin", "Theo, 5:00 pm with Coach Tamsin"), soonest first, with a render test. Polish, also done: a release sent with something missing now scrolls to and focuses the first missing answer, marks each unchecked group "Please check this box." and counts what's left ("8 boxes still need a check.", checked in `e2e/states.spec.ts`); You're in with two children puts its button under the summary; prices read as two rows everywhere; "9:00 am" stays on one line; the Full tag sits under the time; "Pool times that fit" only shows when there are times. Kept: times stay in time order (DECISIONS.md 47). Its "good" list: the first-round fixes held, and walk-throughs 3, 4 and 6, the states, More, Bills and the owner's release versions read as finished.

**Rules checker.** No blocker. Three minor fails and four notes; what was done:

| Finding | Done |
|---|---|
| The hashed release text named a single child that the screen didn't show | The child's name heading always shows, so the text shown is the text hashed |
| Append-only rows could be changed in place through a returned row | Those rows are frozen; test added (DECISIONS.md 50) |
| The Messages line reads like the unruled message box | Kept: it's the brief's own wording for Messages (DECISIONS.md 49) |
| A waitlist-only child has no ID on the signature | Logged: IDs come with the first booking (DECISIONS.md 48) |
| "Saving..." could stick after an unexpected error | The release form catches it and asks to try again |
| No banner on a crash screen | `error.tsx` and `global-error.tsx` added with the banner (DECISIONS.md 51) |
| Moving over could sign twice by revisiting its steps | Refused; test added (DECISIONS.md 52) |

Everything else passed: sandbox and nothing leaving the device, clean room, people choose and prices, family words, SAMPLE marks, the release, signature and authorization rows, child IDs, listed adults, payment, ages and stages, no live view, first Sunday, the 26 later-room rules matching CLAUDE.md, and the keeping notes. It could not run tests itself; the fingerprint, unit and e2e results are from this session's runs: 96 unit tests and 33 e2e tests pass.
