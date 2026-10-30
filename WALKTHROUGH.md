# Walk-throughs

The finish line: a new parent books one child and signs on a phone in under 2 minutes, typing everything. A test can't time a person, so every screen is kept lean and each walk-through counts its taps and typed fields. The owner times one by hand:

**Owner's stopwatch time for walk-through 5 (typing everything, on a phone): ________** (fill in by hand)

All six run in order in `e2e/sign-up.spec.ts` at 375x667, as one serial group sharing one page, so walk-through 6 picks up the families from walk-throughs 1 and 2. Each step saves `screenshots/walkthrough-<n>-<step>.png`, runs axe (no serious or critical issues) and checks the family words, and the counts per screen land in `docs/check-report.md`. The rule behind each step also has a unit test in `tests/unit/walkthrough-rules.test.ts`.

Run them with `npm run e2e` (or `npx playwright test e2e/sign-up.spec.ts`).

## 1. New parent, one child (age 4) at Madison

Fill in a sample family; pool; child; stage; a time with both prices; you and the code; your people; "Just me for now"; bank draft with its authorization box and a backup card; the eight release boxes and two no answers; name; Sign and save my spot.

You're in shows the date, time, pool, instructor and the bank-draft price; one spot is gone; refresh books nothing; one release signature and one bank-draft authorization are saved; "See your first lesson" opens it.

## 2. Two children at Buckhead (ages 3 and 6) with a grandmother listed

The 6-year-old's first choice is Full and offers the waitlist; picking a time next to the sibling works; no date before Sun Nov 8, 2026; the grandmother shows Waiting with the email-us-first line; a yes on one custody question shows the someone-will-talk line and flags that child; one release covers both. Mid-flow, close the tab and come back: "Pick up where you left off" restores the step.

## 3. Two-year-olds

A 2-year-old at Buckhead: told when they can start. A 2-year-old at Madison: private times only, parent in the water, free evaluation still offered; booking only the evaluation says it's never charged and asks for a card.

## 4. The family moving over (two children at Madison)

Checks its details and classes, confirms its email, links the bank with its authorization box, adds the backup card and signs the current release once for both children. Home shows both children and how they pay. Count the taps and typed fields.

## 5. Cold run

A new parent, one child at Madison, every field typed with no fill button, paying by card. The card price shows before they choose. Count the taps and typed fields.

## 6. The first Sunday, continuing walk-through 1

Your first lesson shows parking, door, arrival time, what to bring, "No drop-off" and you alone on deck. Pretend the first lesson happened: Home now leads with the "How it went" note; Progress shows the stage name, the coach's two lines, "On deck: you" and "Approved by Coach [name]"; no tier, no other child; pressing it again adds nothing. Then for walk-through 2's family: the Waiting grandmother is never named as the adult on deck.

## 7. Add a brother or sister, then another class (the next phase)

Continuing walk-through 1's family: "Add a child or a class" on Home; "A brother or sister"; Jules's first name and birth date; The Pier; Sundays at 9:30 am, marked next to Mia's lesson, with both prices; two no answers and the three choices left unchecked; Check and add shows the bank-draft price, "Nothing is charged today." and that the family release already covers Jules; Add Jules. Nothing new is signed (a coverage row instead), Jules gets the next child ID, and a refresh adds nothing. Then "Another class for Mia": her own Sunday class isn't offered; "See Buckhead times instead"; Wednesdays at 4:00 pm; Add this class; the done screen shows Buckhead's SAMPLE directions, and Mia keeps PP26-0042 across both pools. Lesson dates then lists all three classes.

## Counts

The latest counts per screen are in `docs/check-report.md`. Totals from the last full run:

| Walk-through | Screens | Taps | Typed fields |
|---|---|---|---|
| 1. New parent, one child at Madison (with the sample fill) | 13 | 27 | 0 |
| 2. Two children at Buckhead with a grandmother | 14 | 34 | 18 |
| 3. Two-year-olds (Buckhead, then Madison, free evaluation) | 12 | 24 | 13 |
| 4. The family moving over | 9 | 26 | 2 |
| 5. Cold run, one child, typing everything, paying by card | 11 | 23 | 13 |
| 6. The first Sunday | 10 | 13 | 0 |
| 7. Add a brother or sister, then another class | 15 | 18 | 4 |

The finish-line walk-through is 5: one child, every field typed, 23 taps and 13 typed fields (child's first name and three birth-date boxes; your name, email, phone and the code; two emergency contacts' names and phones; your full name to sign). Eight of the taps are the release's required boxes and two are its yes-or-no answers.
