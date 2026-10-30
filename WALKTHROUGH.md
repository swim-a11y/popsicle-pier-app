# Walk-throughs

The finish line: a new parent books one child and signs on a phone in under 2 minutes, typing everything. A test can't time a person, so every screen is kept lean and each walk-through counts its taps and typed fields. The owner times one by hand:

**Owner's stopwatch time for walk-through 5 (typing everything, on a phone): ________** (fill in by hand)

All ten run in order in `e2e/sign-up.spec.ts` at 375x667, as one serial group sharing one page, so later walk-throughs pick up the families from earlier ones (6 from 1 and 2, 7 and 8 from 1, 9 from 2 and 8, 10 from 1). Each step saves `screenshots/walkthrough-<n>-<step>.png`, runs axe (no serious or critical issues) and checks the family words, and the counts per screen land in `docs/check-report.md`. The rule behind each step also has a unit test in `tests/unit/walkthrough-rules.test.ts`.

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

## 8. Bills and a note (after the owner's rulings)

Continuing walk-throughs 1 and 7: Bills shows each month with a line per class, the bank draft price before the card price on every line, the holiday Sunday listed and not billed, and "You pay ... by bank draft"; nothing says fee. Messages: Send a note; "We'll miss a lesson"; Mia; a date from her lessons; the exact words; Send this note. The note waits for a person, no text box appears anywhere, and Lesson dates mark the day Missing.

## 9. The owner's approvals inbox

As the owner: walk-through 2's Ada waits under "Talk with a family first" (a yes on the custody question, no details); "We've talked with the family" clears it. Mia's note is marked read. Ada waits for the full Sunday 9:00 class; Pretend a family left a full class; a person picks "In place of the Sunday 10:00 am class", sees the drafted words and sends them. As Ada's family: Home says the school needs an answer; Messages shows the offer with both prices; Yes, book it moves Ada to 9:00 and off the waitlist.

## 10. A lesson the school cancels

Mia's family sees its note was read. Pretend the school cancelled a lesson: Messages says which lesson and that a person offers another date with Coach Dev. As the owner: pick one date with Coach Dev, see the drafted words, send. As the family: Home asks for an answer; Yes, that works; Lesson dates show the cancelled day with its new date, and Bills says the lesson stays on the bill with its new date.

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
| 8. Bills and a note | 10 | 12 | 0 |
| 9. The owner's approvals inbox | 7 | 12 | 0 |
| 10. A lesson the school cancels | 11 | 14 | 0 |

The finish-line walk-through is 5: one child, every field typed, 23 taps and 13 typed fields (child's first name and three birth-date boxes; your name, email, phone and the code; two emergency contacts' names and phones; your full name to sign). Eight of the taps are the release's required boxes and two are its yes-or-no answers.
