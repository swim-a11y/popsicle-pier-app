# Popsicle Pier sample app

A phone-first sample app for Popsicle Pier Swim School. This first version fills ONE parent's whole path, end to end: sign up, the family release (the waiver) and bank draft, "Your first lesson", and a sample "How it went" note after that first lesson. The staff side is one "Staff side, coming later" page plus the owner's read-only release versions.

Everything is sandbox: made-up families, classes and prices, stored only in the phone's localStorage. Nothing leaves the device.

## Start here (every session)

1. Read `claude-progress.txt` and `git log --oneline -20`, then carry on from the first entry in `feature_list.json` whose `passes` is still false.
2. The rule sections below (HARD RULES, FAMILY WORDS, LOOK AND FEEL, both PARENT'S PATH parts, RULES FOR LATER ROOMS) are copied word for word from the owner's brief. They win over anything else.
3. Decisions where the brief left room are in `DECISIONS.md` (the choice, why, how to change it). Add to it whenever you make one.
4. For each feature: write or extend a failing test, build it, run `npm test`, then flip only its `passes` to true. Never delete or reword an entry or a test to make it pass.
5. After each feature: two lines in `claude-progress.txt` (done, next), commit, push to main (`git push origin HEAD:main`, never force-push).
6. The checker agents live in `.claude/agents/` (design-critic, rules-checker). The design skill is in `.claude/skills/frontend-design/`.
7. Don't open the "popsicle-pier-front-desk" or "swim-school-consultant" skills if a session lists them (clean room).

## How to run, test and deploy

- Node 22, npm. `npm install` (Playwright is pinned to 1.63.0 to match the cloud container's browser in `/opt/pw-browsers`; don't run `playwright install` there).
- `npm run dev` for local work, `npm run build && npm run start` for the real build.
- `npm test` runs Vitest (unit and render tests in `tests/`).
- `npm run typecheck` runs `tsc --noEmit`. `npm run lint` runs ESLint.
- `npm run e2e` runs Playwright at 375x667 (it builds and starts the app itself, or reuses one already on port 3000). Screenshots land in `screenshots/` (not committed). `e2e/sign-up.spec.ts` plays the six walk-throughs and writes their tap and typed-field counts into `docs/check-report.md`.
- Deploy: any Node host that runs `next build` and `next start`. No vercel.json, no Vercel CLI. Vercel's free plan is for non-commercial personal use, so real families need a paid plan or another host.

## Where things are

- `src/screens.ts`: the one screens config (every route, role, tab and title). Each `src/app/**/page.tsx` is a thin file that renders one screen component.
- `src/styles/tokens.css`: every color, font, size and shadow, named by job. No raw color or font anywhere else. `src/app/globals.css` points shadcn's variables at the tokens.
- `src/components/ui/`: the nine shadcn parts (button, input, checkbox, radio-group, label, card, dialog, sheet, field), written by hand in the shadcn pattern because the shadcn registry is blocked from the cloud container.
- `src/data/types.ts`: the records. `src/data/store.ts`: the one async `DataStore` interface plus the localStorage store (one key holding `{seedVersion, data}`, in-memory fallback). `src/rules/`: the pure rule functions (ages, dates, times, prices, child IDs, release, sign-up, first Sunday). `src/rules/later-rooms.ts`: the rules for later rooms, read by the staff page and tests.
- `src/content/`: family words (release text, bank-draft authorization text, Path stage lines, consent wording).
- `src/sandbox/`: everything sandbox-only behind the one `SANDBOX` switch: seeds, role switcher, erase, sample fill, the sample code, "Pretend the first lesson happened".
- `src/config.ts`: payment settings (cardPricing, evaluationAsksForCard).

## The app: six rooms plus two later wings

This build fills the parent's side only; the rest is named so later rooms fit.

1. Family: sign-up, the family release, children, listed adults, messages.
2. Schedule: classes, lesson dates, closures, waitlists, owed lessons.
3. Deck: today's roster, a mark for every child at every lesson, notes, incidents.
4. Money: bank draft first with a card price, monthly bills and drafts, credits the owner approves.
5. Progress and Video: stage on the Path, monthly note, clips, family library.
6. Office and Owner: approvals inbox, numbers, staff, release versions, agents' log.
- Wing (later): Workouts.
- Wing (later): Swim team.

## Records the later rooms will need (not in code yet)

- Schedule: Closure, OwedLesson (offered date, answer by, second date, closed), FillIn (same instructor, the week after), WaitlistOffer (a person's choice).
- Deck: RosterDay (a person builds it), CheckIn (the attendance record), Incident (holds that lesson's video), HoldFlag (health or custody yes, no details).
- Money: Bill, BillLine (both prices), Charge (scheduled, pending, settled, returned, refunded, disputed), Credit (owner approves), RegistrationFee, CountyFee, FoundingMarker, FacilityShareReport, Deposit and DepositLine, PaymentCostMonth.
- Progress and Video: StageChange (staff choose), MonthlyNote, Clip (released only after its mark is confirmed), LibraryItem, SeasonReel.
- Office and Owner: ApprovalItem, StaffMember, InstructorCredential (lifeguard, CPR, background check), RecordingAcknowledgment, AgentLogEntry, ParticipantCount, TalkFlag, CheckInDraft.
- Wings: Workout, SwimTeamMember.

## Done

- Setup: Next.js 16.4.3 (App Router, TypeScript, Tailwind 4, ESLint), the nine shadcn parts by hand, tokens, fonts from npm, Vitest, Playwright 1.63.0 with axe, the hooks, the two checker agents, the design skill.
- Step 1: the sample banner, the Sandbox pill and sheet, parent and owner tab bars, the shared coming-next component, 26 static pages from src/screens.ts.
- Step 2: the DataStore and localStorage store, seeds, and the rules for dates, ages, times, prices, child IDs, the release, sign and save, and the first Sunday.
- Step 3: sign-up (start screen and nine steps) through You're in.
- Step 4: Your first lesson, Progress with How it went, Parent Home.
- Step 5: the family moving over, the owner's release versions, More, Bills and Messages (coming next), the staff page.
- Step 6: all six walk-throughs pass at 375x667 in e2e/sign-up.spec.ts; counts in docs/check-report.md and WALKTHROUGH.md.
- Every entry in feature_list.json passes.

## Next

- The next room to fill is Schedule (closures, owed lessons, fill-ins, waitlist offers a person makes), using the records listed above.
- Re-signing and adding a child exist in the data layer (src/rules/release.ts) with tests, but have no screens yet ("Add a child or a class" is a coming-next card on Home).
- A second session runs /code-review and /security-review.

## Known issues

- None open. (Anything an agent round leaves unfixed is listed here.)

## Keep for later (from the owner's handoff notes)

- Keeping: signed releases are never removed before the youngest swimmer named turns 21; raw lesson video to age 25; coaching data with faces removed, no end date; removal on request from 18; family library access for the session plus 30 days; family mail 2 years; staff records for employment plus 3 years; bank-draft authorizations at least 2 years after they end.
- Bank draft: an authorization the family signs or authenticates, a copy to the family, every bill at least 10 days before its draft, and each bank account checked on its first use.
- A card fee can never apply to debit cards, so "card fee" mode needs the processor to tell debit from credit. The card price never runs above what cards cost the school.
- Before choosing a processor for the real app: a written quote with reserve terms and returned-draft limits, compared on bank-draft cost. Finix's published rate (1% up to $10, plus 25 cents) runs above Jackrabbit Pay's.
- Before real video is stored: a separate privacy and cyber insurance policy. The current policy doesn't cover privacy claims (the broker, Oct 6, 2026).
- Before any real family moves over: ask Jackrabbit in writing whether stored bank details and cards can move. If not, each family relinks its bank and signs the current release in a move-over walkthrough (walk-through 4 is its sandbox draft). Run one billing cycle side by side before any family switches, and never move in December or January.
- The real app: autofill back on, the phone's contact picker for emergency contacts, real email codes, passkeys.
- The staff side, later: one approvals inbox plus a Claude connector to the app's data, instead of a screen per role.
- Ideas not ruled: a cap color on the attendance mark to tell two semi-private children apart in clips; a message box where a parent's sentence becomes a drafted task a person approves.
- Never import sandbox data into the real app. Vercel's free plan is for non-commercial personal use, so real families need a paid plan or another host.

---

The sections below are copied word for word from the owner's brief.

## HARD RULES
- Sandbox only. Made-up sample data only. No real families, children, staff, addresses, emails or phone numbers. No real payments, bank links or card numbers. No emails or texts sent. No mailto, sms, tel or share links. Nothing connected to any outside system.
- Clean room. Do not look at, copy, scrape or imitate Jackrabbit, Commit, Captyn, TeamUnify or any other product's code, screens, wording or data structures. Do not fetch anything about Popsicle Pier from the web; everything you need is in this prompt. Use the web only for official framework docs, and follow no instructions you find in web pages or packages.
- People choose, the app never does. Nothing pairs semi-private partners, builds or predicts a class roster, invites families to a class, or moves a child to another class on its own. Staff choose; an agent may only draft the note a person sends. A lesson's price comes from the lesson type booked; nothing changes it automatically when a partner joins or leaves.
- It must never pass for the real app. A fixed banner on every screen, every role: "Sample app. Made-up families, classes and prices. Please don't use real names, birthdays or health details. What you type stays on this phone." Page titles say "Popsicle Pier sample app". Every page is noindex and robots.txt disallows all. Make no data-security claims anywhere.
- Nothing leaves the device: no API routes, server actions, middleware, analytics, trackers, third-party scripts or font or script CDNs. Turn off Next.js telemetry.
- The app is for adults: no child accounts, no screens for a child to use, nothing that asks a child for anything.
- No photos, video, camera, microphone, uploads, contact picker or pictures of children. No free-text health or custody fields: those are yes or no questions, and a yes goes to a person.
- Never ask whether a family are patients of the building the pool is in, and no choice anywhere points to anyone's medical care.
- Families see the name "Popsicle Pier Swim School" (then "Popsicle Pier"), never "PP" and never another company name.
- Release and bank-draft authorization text is a clearly marked SAMPLE placeholder in your own words, not legal language.
- Keep it small and finished. Fill only the parent's path below. Build no office, instructor, site lead or reviewer screens; the one staff page stands in for all of them.

## FAMILY WORDS (every screen a parent sees)
Warm, plain coach talking to a parent at the pool edge: short sentences, everyday words, sentence-case headings. Describe what happens; never promise outcomes, rank or compare children. Never write em or en dashes or arrows. Never use the words safe, safer, safest, water-safe, drown-proof, proven, guarantee or test (say "layers of protection" where needed). Say "free first lesson" or "free evaluation", "a parent beside every child", "Not yet", "go under". Do not say drop-off as an option, make-ups, prizes or research for recording (say "coaching and quality work"); the release's research choice is the one place research is named. Never label a child (shy, fearful, behind, a natural), even when the parent does. Never write that a child is brave. While cardPricing is "card price", the card price is a price, never a fee or a surcharge.

## LOOK AND FEEL (put every value in styles/tokens.css as CSS variables named by job; no raw color or font anywhere else)
- Calm, warm, premium. Few things per screen, large type for what matters (child, day, time), one accent kept for the main action. No sidebars, tables, dashboard tiles, hamburger menus or emoji. Light theme only.
- Colors: navy #163A5C (top bar, headings, white text on it); action #275681 (primary buttons and links, white text); teal #00A8A0 (accent and success marks, dark text only, never white text on teal); sun #F2B300 (one highlight per screen at most, dark text only); background cream #F7F6EF; cards white; text ink #152B44 (never pure black). No red: errors sit in a pale sun box #FCEFC7, success in pale teal #DCF1EF. Focus ring navy.
- Fonts: Questrial for headings (weight 400), Work Sans for text (400 and 600), installed from npm as @fontsource/questrial and @fontsource/work-sans so nothing is fetched at build or run time. Remove the Geist fonts and any next/font/google import that create-next-app adds. Fallback: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif.
- shadcn/ui parts are themed only through tokens.css: point shadcn's variables (--background, --foreground, --primary, --primary-foreground, --muted, --border, --ring, --radius and the rest) at the token values, and delete the default palette and the dark theme. The frontend-design skill guides craft and layout; the values in this section win over its own picks.
- Name: a text wordmark "Popsicle Pier" in Questrial, navy on cream. No logo image.
- A test checks token contrast: text 4.5:1, lines and focus 3:1.

## THE PARENT'S PATH, PART ONE: sign-up, the family release and bank draft
Seeds:
- 2 pools: Madison (youngest age 2; 1 or 2 swimmers per lesson, 3 by request not built) and Buckhead (youngest age 2 and a half; 1 or 2 per lesson). Invented SAMPLE first-lesson notes per pool: where to park, which door, how early to arrive, where to wait on deck, what to bring. Mark them SAMPLE on screen.
- About 8 sample classes across both pools: Path stage, age range, day, time, instructor first name (invented), open spots and two SAMPLE prices per lesson, bank draft and card. Include one full class and one semi-private class with one child and one open spot. Lessons are 27 minutes in a 30-minute slot. Under 3 is a private lesson with a parent in the water, so seed private times for under 3 and never put an under-3 in a shared class. No Buckhead lesson date before Sunday, November 8, 2026.
- A few free evaluation times per pool.
- Each pool's SAMPLE school email, shown as plain text (never a mailto link) wherever a screen says to email us.
- Path stages, in order: The Pier, The Shallows, The Cove, Open Water. Families see the stage name only, never a tier, counts or another child.
- Release versions v1 and v2, v2 current, each with 2 or 3 "What changed" lines. v2 holds all eight groups in step 9. Published text never changes.
- One family moving over from Jackrabbit, seeded directly (never an import file): one parent with both emergency contacts, two children enrolled at Madison in their current classes and prices, one listed adult shown Waiting, nothing signed in this app and no bank linked. Until Jackrabbit answers in writing, assume every family relinks its bank.
- About 6 SAMPLE coach-line templates per Path stage, in the FAMILY WORDS voice, each two lines: one thing the child did today and one thing to work on next (for example "Today [name] blew bubbles with their face in the water and kicked across the step with help. Next we'll work on floating on their back."). No promises, no ranking, no comparing.

Payment settings, in src/config.ts, one line each, each in DECISIONS.md:
- cardPricing: "card price" (default: bank draft has the lower price and the card its own higher one, about 3 percent more, rounded to a quarter) or "card fee" (one price plus a fee on cards). Never both.
- evaluationAsksForCard: true (booking only the free evaluation asks for a card that is never charged).

Sign-up, one topic per screen, "Step 3 of 9" counting only the steps this family needs. A screen with one single choice moves on when it's tapped. Every email in sign-up must end in @example.com and every phone number use 555. Autofill is off on every field; the Sandbox sheet's "Fill in a sample family" fills them.
1. Pool.
2. Your swimmers: each child's first name and birth date (three number boxes). Age is figured on the first lesson date. Never ask about toilet training; show "Every child 3 and under, and any child who isn't toilet-trained, wears a snug reusable swim diaper."
3. For each child: "Which sounds most like [name] today?" with one plain SAMPLE line per Path stage, or "Not sure? Free evaluation".
4. Times that fit each child at that pool, marking ones next to a sibling's. Each time shows both prices, bank draft first. Full times say "Full" and can't be tapped. If nothing fits: join the waitlist or book the free evaluation. Below a pool's youngest age: say when they can start. Under 3: private times only. A semi-private time with no partner yet says: "No partner yet. You pay the semi-private price for the first month. If we haven't found a partner by then, we'll talk with you before anything changes."
5. You: name, email and phone, then a 6-digit code to confirm the email: show "Sample code: 246810" on screen, since the real app would send it, and use autocomplete="one-time-code". Then "How did you hear about us?", required, one tap: a card at the front desk; a neighborhood app or site; an online parent group; my child's school or preschool; an online listing; a friend, neighbor or family member; a web search; other.
6. Your people: two emergency contacts (name and phone), then "Anyone else who should get our messages?" (up to two adults, name and email) or Skip.
7. Who stays: first say "There's no drop-off. A parent, guardian or signed listed adult stays at the pool the whole lesson, or the lesson doesn't start. Every lesson is recorded for coaching and quality work, so please tell each adult you list." Then other adults: first name and relationship (parent, guardian, grandparent, nanny, other), or "Just me for now". Anyone already typed in step 6 is one tap here, never typed again. Each adult shows Waiting or Signed. Today's rule: listed adults sign on paper at the check-in desk. If a listed adult isn't a parent or guardian, add: "For now, if the only adult staying would be someone other than a parent or guardian, email us before the lesson so we can confirm it."
8. Payment: "Nothing is charged today." Bank draft first, marked preferred, with its price; card second, with its own price. Each is one tap with no number boxes. Bank draft shows a short SAMPLE authorization (we draft each month's bill on the 1st; every bill reaches you by the 19th, at least 10 days before; you can cancel by emailing us) with its own box, "I authorize these bank drafts", and a copy saved to the family's account ("In the real app we'd email you a copy too."). Then a required one-tap "Add a backup card (sample)" says: "We'd only charge this card if a bank draft comes back unpaid, after we tell you, at the card price." Only the free evaluation booked: "The free evaluation is never charged."; with evaluationAsksForCard on, it asks for a card to hold the spot.
9. Family release, signed once for the whole family at the END: "Covers [names]". Every line is visible, short and plain, never folded, in eight groups, each with its own required box:
   a. Staying at the pool: no drop-off; a parent, guardian or signed listed adult stays the whole lesson, or the lesson doesn't start, or it stops.
   b. Recording: every lesson is recorded on video and audio, free first lessons included, and adults on deck or in the water too; recordings are kept as a protection record; I'll tell each adult I list.
   c. AI review and our tools: recordings are reviewed with AI for coaching and quality work, never research unless you say yes below; clips are matched by roster and time slot, with no facial recognition; any outside service that touches video is a business account whose terms bar training on it; coaching data with faces removed may train our own coaching tools, used at our pools and by licensed partners; raw video of a child is never shared with partners; nothing is ever sold.
   d. Who can watch: school leaders may watch lessons live; lessons are never streamed to families or the public; video may be used to look into an injury or a concern, and released when the law requires.
   e. Keeping and your family library: full lesson video stays in your account for the session plus 30 days; highlights and a season reel stay as long as you have an account; a copy you download is yours to protect; raw video is kept until the child turns 25, opened only for a claim, a concern or a legal requirement; coaching data with faces removed is kept with no end date; at 18, a child can ask us to remove their identifiable video from coaching and research use; lesson video never goes on personal phones or accounts.
   f. Other families: in a semi-private lesson, video and clips may show the other child; families don't post or share video of another family's child.
   g. Signing for my children: I'm 18 or older and have legal authority to sign for each child named. For each child, yes or no: "Is there a court order, custody arrangement or foster placement that limits recording or who may bring [name]?" and "Is there anything about [name]'s health we should know before the first lesson?" A yes shows "Thanks. Someone from the school will talk with you before the first lesson." and flags that child for a person. No text box.
   h. Release of claims: a SAMPLE paragraph in your own words, shown in full.
   Then three choices, unchecked, chosen per child, where "no" never changes lessons: research (an observational study of how children's courage grows in lessons; a review board approves it first; withdraw anytime by email); marketing (photos and video in our posts, first name or no name); underwater images. Then, separate from the release and unchecked: the texts box, with exactly: "Text me about lesson cancellations and schedule changes. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of enrollment." Then two more unchecked boxes: our email newsletter, and marketing emails. Then a typed full name, one box "I agree to this release and to signing it electronically", and the button "Sign and save my spot" (shows "Saving..." and ignores double taps).

The signature row holds: family, typed name, each group's yes, each child's choices and yes or no answers, child IDs, version, SHA-256 of the exact text shown, time, how it was signed (online or paper at the desk), the confirmed email, the browser name, and each consent with its exact words and wording version. The bank-draft authorization row holds the family, the processor reference, its exact words and version, the confirmed email and the time. A test fails if a version's text and its fingerprint stop matching.

Keep their place: each step has its own URL; Back goes one step and keeps answers; the draft saves after every step and the start screen offers "Pick up where you left off". The start screen also says "Already with us? Moving your family over is coming next." "You're in" has its own address, so a refresh never books twice.

"You're in" shows: each child's first lesson (date, time, pool, instructor) and the price they'll pay, "Nothing was charged today. Your first bill comes before your first lesson.", any "someone will talk with you" line, "Sample only. No real spot was saved and no one at the pool was told.", and one primary button, "See your first lesson". Spots drop by one per child.

Parent Home: first, a card for the next thing that matters (before the first lesson: "Your first lesson" with the day and time; after it: the newest "How it went" note). Then children and their stages, their classes and prices, which release version the family signed, how they pay, and "Add a child or a class" as a coming-next card. Re-signing and adding a child live in the data layer with unit tests, not on screens, in this build: a family on an older version signs the current version once for everyone; a family on the current version adding a child signs nothing and gets a new coverage row, never an edit. A child added at the other pool keeps one ID across both pools.

Family moving over: "Welcome to the new Popsicle Pier app." Its details, people and classes are already there to check, one tap each ("Looks right"); a change says to email us. Then it confirms the parent's email with the sample code, does step 8 (bank draft with its authorization box and the backup card) and step 9 (the current release, signed once for every child, with the three choices and the texts and email boxes), then lands on Home. It never retypes anything the school already has.

Owner Release versions: each version's date, What changed lines, fingerprint and how many sample families signed it.

## THE PARENT'S PATH, PART TWO: the first Sunday
Your first lesson (its own tab and address; one page that answers where, what and who at a glance; for two children, one section per child and the shared notes once):
- At the top, large: the child's first name, day, date, time, pool and instructor first name. "The lesson runs 27 minutes."
- Getting there: the pool's SAMPLE street address, parking, door and how early to arrive.
- What to bring: the pool's SAMPLE list (suit, towel and the like). For a child 3 and under, the swim diaper line from step 2. For an under-3: "Bring your suit, you're in the water too."
- Who stays: "You or a signed listed adult stay at the pool the whole lesson, or the lesson doesn't start. No drop-off." Then each listed adult with Waiting or Signed; a Waiting adult says "Signs on paper at the check-in desk before their first lesson." Then "Brothers and sisters wait on deck with you." and "Every lesson is recorded for coaching and quality work."
- What happens: three short SAMPLE lines on how a first lesson goes (meet the coach, get comfortable in the water, a minute at the end to hear how it went). Describe; never promise.
- "Need to miss, move or stop? Email us at [the pool's school email]." (plain text: no phone number, no mailto link, no promise of a replacement lesson).
- These family lines are allowed on parent screens.

How it went (in the Progress tab, newest first; also the Home card after a lesson):
- "Pretend the first lesson happened" in the Sandbox sheet (sandbox only) records, for each child of the current family, an attendance mark naming who stayed (the parent, or a listed adult only if Signed), then an approved lesson note built from a coach-line template for the child's stage, dated on that child's first lesson date. A second press adds nothing.
- The note shows: date, pool, the child's first name, "Coach [first name]", the child's Path stage name, the coach's two lines, "On deck: [you or the adult's first name]" (for an under-3: "In the water with [name]: you"), and "Approved by Coach [first name]". Mark it "Sample note".
- Families see their own child only, the stage name only (never a tier, counts or another child), and no photos, video or clips. One line says "Lesson clips come in a later version."
- Only approved notes ever reach a parent screen; a draft note never does (a check proves it).

States: skeleton rows until stored data loads (never a flash of "nothing here"); a no-fit message with a next step; Full; Saving...; a code that doesn't match; before the first lesson, Progress says "Your first 'How it went' note comes after [name]'s first lesson on [day]."

## RULES FOR LATER ROOMS (show on the staff page only; do not build them; keep them in one rules file that screens and tests read)
- Being checked in at the pool is the attendance record. Families email absences (parent screens may say so).
- A family's own miss gets a fill-in only: same instructor, the week after.
- A lesson the school cancels is made up with the child's own instructor within three weeks: one date offered, a week to answer, one more date, then it closes with no credit. A credit only when no opening exists, and only with the owner's approval.
- Closed days are never billed and never made up.
- A second no-show in a month goes to the owner as "time for a talk".
- Two missed lessons in a row, for any reason, draft a check-in note to the family; a person sends it.
- No drop-off: a parent, guardian or signed listed adult stays the whole lesson, or it doesn't start. No instructor is ever alone with a child; with no other adult there, lessons stop.
- Until the insurer answers in writing, a lesson whose only adult isn't a parent or guardian waits for the owner's okay.
- A health or custody yes holds that child's first lesson until a person has talked with the family. The roster shows a flag, never the details.
- The attendance mark files the video: child ID, pool, date and slot, instructor, and the adult present and whether they're a parent or guardian. No clip reaches a family until its mark is confirmed.
- An incident holds that lesson's video: nothing is removed or deleted while it's open.
- Staff choose semi-private partners and who is invited to any class; agents only draft the note a person sends.
- An unpaired semi-private child pays the semi-private price for the first month from the first lesson. If there's still no partner, the family hears at least three weeks before the price changes. The month starts again when a partner leaves.
- A charge moves through scheduled, pending, settled, returned, refunded or disputed. A bill shows "pending" until the bank settles it, and a returned draft is still owed. What the processor charges the school is the school's cost, never a family's.
- Each month's bill reaches the family by the 19th, at least 10 days before the draft on the 1st, with bank draft and card prices on every line.
- Fees live on the family: a yearly registration fee on the enrollment anniversary, capped per family; a quarterly per-family fee at one pool for families from outside its county; and a founding marker that lowers every lesson for every child in the family.
- One pool shares a percent of collected lesson revenue with its facility, reported by the 15th; registration fees, refunds and chargebacks are left out.
- Every processor deposit breaks down into each family's charges, the processor's fees and the net, so the books match it line by line. The books live in the owner's own QuickBooks file and a CPA reviews them. Anything that reads the books sees money records only, never a child's record.
- Agents never answer about an injury, a refund, custody or a pickup change, a medical question, a scared child, a move to another class or stage, or a concern about how a child was treated; a person does.
- Live view is for the three school leaders only; nothing is ever streamed to families or the public.
- Each instructor's record holds a signed acknowledgment of recording and live view, and lifeguard, CPR and background-check dates. The roster shows whether today's instructor holds a current lifeguard card.
- The owner's numbers count participants by pool for the insurer's year-end audit.
- The owner's numbers show what payments cost the school each month, bank draft and card side by side, with the effective rate.
- Families see their child's stage, never a tier, and never another child.
- No facial recognition; clips matched by roster and slot; nothing sold.
- Agents draft and a person approves, in every room.
