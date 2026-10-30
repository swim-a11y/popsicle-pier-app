"use client";

import { useState } from "react";

import { PriceRows } from "@/components/parts/price-rows";
import { SkeletonRows } from "@/components/parts/skeleton";
import { Tag } from "@/components/parts/tag";
import { PageTitle, ScreenShell } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import { MESSAGES_LINE } from "@/content/messages";
import { getStore } from "@/data/app-store";
import { newId } from "@/data/ids";
import type { AppData, DateOnly, FillIn, OwedLesson, WaitlistOffer } from "@/data/types";
import { useAppData } from "@/data/use-data";
import { useGo, useQueryValue } from "@/lib/nav";
import { skippedDates } from "@/rules/closures";
import { clockTime, firstOpenLessonDate, longDate, shownAtSchool, todayAtSchool } from "@/rules/dates";
import { currentFamily } from "@/rules/family";
import { answerFillIn, fillInsForFamily } from "@/rules/fillins";
import { offerOpen } from "@/rules/holds";
import { notesForFamily } from "@/rules/notes";
import { answerWaitlistOffer, offersForFamily } from "@/rules/offers";
import { answerOwedOffer, answersWaiting, owedForFamily, owedState } from "@/rules/owed";

function AnswerButtons({ yes, onAnswer, busy }: { yes: string; onAnswer: (answer: "yes" | "no") => void; busy: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <Button size="block" disabled={busy} onClick={() => onAnswer("yes")}>
        {busy ? "Saving..." : yes}
      </Button>
      <Button variant="secondary" size="block" disabled={busy} onClick={() => onAnswer("no")}>
        No, thanks
      </Button>
    </div>
  );
}

/** Saves an answer once, ignoring double taps, and says so if the offer closed meanwhile. */
function useAnswer() {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const answer = async (work: (today: DateOnly, now: string) => Parameters<ReturnType<typeof getStore>["transaction"]>[0]) => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const now = new Date();
      await getStore().transaction(work(todayAtSchool(now), now.toISOString()));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "That didn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return { busy, problem, answer };
}

function WaitlistOfferCard({ data, offer, today, first }: { data: Readonly<AppData>; offer: WaitlistOffer; today: DateOnly; first: boolean }) {
  const { busy, problem, answer } = useAnswer();
  const child = data.children.find((c) => c.id === offer.childRecordId);
  const cls = data.classes.find((c) => c.id === offer.classId);
  const pool = data.pools.find((p) => p.id === offer.poolId);
  const lt = cls ? data.lessonTypes.find((l) => l.id === cls.lessonTypeId) : undefined;
  const booked = offer.enrollmentId ? data.enrollments.find((e) => e.id === offer.enrollmentId) : undefined;
  const open = offerOpen(offer, today);
  if (!child || !cls || !pool) return null;
  const starts = firstOpenLessonDate(cls.weekday, today, pool.opensOn, skippedDates(data, cls, today));
  return (
    <article className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card" aria-labelledby={`offer-${offer.id}`} data-testid="school-offer">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`offer-${offer.id}`} className="font-heading text-big text-heading">
          A spot for {child.firstName}
        </h3>
        {open ? <Tag tone={first ? "highlight" : "plain"}>Needs your answer</Tag> : null}
      </div>
      <p data-testid="offer-words">{offer.words}</p>
      {open ? (
        <>
          {lt ? <PriceRows bankCents={lt.bankDraftCents} /> : null}
          <p>If you say yes, the first lesson there is {longDate(starts, today)}.</p>
          <AnswerButtons
            yes="Yes, book it"
            busy={busy}
            onAnswer={(a) =>
              void answer((t, now) => (tx) => answerWaitlistOffer(tx, { offerId: offer.id, familyId: offer.familyId, answer: a, today: t, now, newId }))
            }
          />
        </>
      ) : offer.answer === "yes" ? (
        <p className="rounded-control bg-success px-3 py-2" data-testid="offer-status">
          You said yes. {child.firstName}&apos;s first lesson there is {booked ? longDate(booked.firstLessonDate, today) : "coming up"}.
        </p>
      ) : offer.answer === "no" ? (
        <p data-testid="offer-status">You said no, thanks. {child.firstName} stays on the waitlist.</p>
      ) : (
        <p data-testid="offer-status">
          No answer by {longDate(offer.answerBy, today)}, so this offer closed. {child.firstName} stays on the waitlist.
        </p>
      )}
      {problem ? <p className="rounded-control bg-notice px-3 py-2">{problem}</p> : null}
    </article>
  );
}

function CancelledCard({ data, owed, today, first }: { data: Readonly<AppData>; owed: OwedLesson; today: DateOnly; first: boolean }) {
  const { busy, problem, answer } = useAnswer();
  const child = data.children.find((c) => c.id === owed.childRecordId);
  const pool = data.pools.find((p) => p.id === owed.poolId);
  const cancellation = data.cancellations.find((c) => c.id === owed.cancellationId);
  const cls = cancellation ? data.classes.find((c) => c.id === cancellation.classId) : undefined;
  if (!child || !pool) return null;
  const state = owedState(data, owed, today);
  const timeOf = (o: OwedLesson["offers"][number]) =>
    (o.timeKind === "class" ? data.classes.find((c) => c.id === o.timeId) : data.evaluationTimes.find((e) => e.id === o.timeId))?.startTime ?? "";
  return (
    <article className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card" aria-labelledby={`owed-${owed.id}`} data-testid="school-cancelled">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`owed-${owed.id}`} className="font-heading text-big text-heading">
          We cancelled {child.firstName}&apos;s lesson
        </h3>
        {state.kind === "waiting" ? <Tag tone={first ? "highlight" : "plain"}>Needs your answer</Tag> : null}
      </div>
      <p>
        {longDate(owed.cancelledDate, today)}
        {cls ? ` at ${clockTime(cls.startTime)}` : ""}, {pool.name}. {cancellation ? `${cancellation.reason}.` : ""}
      </p>
      {owed.offers
        .filter((o) => o !== (state.kind === "waiting" || state.kind === "booked" ? state.offer : null))
        .map((o) => (
          <p key={`${o.timeId}-${o.date}`}>
            {longDate(o.date, today)} at {clockTime(timeOf(o))}: {o.answer === "no" ? "you said no, thanks." : "no answer in time."}
          </p>
        ))}
      {state.kind === "waiting" ? (
        <>
          <p data-testid="offer-words">{state.offer.words}</p>
          <AnswerButtons yes="Yes, that works" busy={busy} onAnswer={(a) => void answer((t, now) => (tx) => answerOwedOffer(tx, { owedId: owed.id, familyId: owed.familyId, answer: a, today: t, now }))} />
        </>
      ) : state.kind === "booked" ? (
        <p className="rounded-control bg-success px-3 py-2" data-testid="offer-status">
          You said yes. {child.firstName}&apos;s lesson is on {longDate(state.offer.date, today)} at {clockTime(timeOf(state.offer))} with Coach {owed.instructorFirstName}.
        </p>
      ) : state.kind === "closed" ? (
        <p data-testid="offer-status">Neither date worked, so this one is closed. It stays on your bill.</p>
      ) : state.kind === "credited" ? (
        <p className="rounded-control bg-success px-3 py-2" data-testid="offer-status">
          No date with Coach {owed.instructorFirstName} was open, so the owner approved a credit. {longDate(owed.cancelledDate, today)} comes off your bill.
        </p>
      ) : state.kind === "no-opening" ? (
        <p data-testid="offer-status">A person at the school is checking what&apos;s open with Coach {owed.instructorFirstName}.</p>
      ) : (
        <p data-testid="offer-status">A person at the school is choosing a date with Coach {owed.instructorFirstName}.</p>
      )}
      {problem ? <p className="rounded-control bg-notice px-3 py-2">{problem}</p> : null}
    </article>
  );
}

function FillInCard({ data, fillIn, today, first }: { data: Readonly<AppData>; fillIn: FillIn; today: DateOnly; first: boolean }) {
  const { busy, problem, answer } = useAnswer();
  const child = data.children.find((c) => c.id === fillIn.childRecordId);
  const o = fillIn.offer;
  const time = (o.timeKind === "class" ? data.classes.find((c) => c.id === o.timeId) : data.evaluationTimes.find((e) => e.id === o.timeId))?.startTime ?? "";
  const open = o.answer === null && offerOpen(o, today);
  if (!child) return null;
  return (
    <article className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card" aria-labelledby={`fill-in-${fillIn.id}`} data-testid="school-fill-in">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`fill-in-${fillIn.id}`} className="font-heading text-big text-heading">
          A fill-in for {child.firstName}
        </h3>
        {open ? <Tag tone={first ? "highlight" : "plain"}>Needs your answer</Tag> : null}
      </div>
      <p data-testid="offer-words">{o.words}</p>
      {open ? (
        <AnswerButtons yes="Yes, that works" busy={busy} onAnswer={(a) => void answer((t, now) => (tx) => answerFillIn(tx, { fillInId: fillIn.id, familyId: fillIn.familyId, answer: a, today: t, now }))} />
      ) : o.answer === "yes" ? (
        <p className="rounded-control bg-success px-3 py-2" data-testid="offer-status">
          You said yes. {child.firstName}&apos;s fill-in is on {longDate(o.date, today)} at {clockTime(time)} with Coach {fillIn.instructorFirstName}.
        </p>
      ) : o.answer === "no" ? (
        <p data-testid="offer-status">You said no, thanks.</p>
      ) : (
        <p data-testid="offer-status">No answer by {longDate(o.answerBy, today)}, so this fill-in closed.</p>
      )}
      {problem ? <p className="rounded-control bg-notice px-3 py-2">{problem}</p> : null}
    </article>
  );
}

/** Notes between the family and the school: ready-made notes only, and the school's offers to answer. */
export function MessagesScreen() {
  const loaded = useAppData();
  const go = useGo();
  const sent = useQueryValue("sent");
  if (!loaded) {
    return (
      <ScreenShell id="messages">
        <SkeletonRows rows={4} />
      </ScreenShell>
    );
  }
  const { data, today } = loaded;
  const family = currentFamily(data);
  if (!family) {
    return (
      <ScreenShell id="messages">
        <PageTitle>Messages</PageTitle>
        <p>Once you sign up, you can send the school a note about a lesson here, and answer the school.</p>
        <Button size="block" onClick={() => go("/sign-up")}>
          Sign up for lessons
        </Button>
      </ScreenShell>
    );
  }
  const waiting = answersWaiting(data, family.id, today);
  const offers = offersForFamily(data, family.id);
  const owed = owedForFamily(data, family.id);
  const notes = notesForFamily(data, family.id);
  // Anything waiting for an answer first, then the rest newest first.
  const school = [
    ...offers.map((o) => ({ key: o.id, at: o.answeredAt ?? o.offeredAt, open: waiting.some((w) => w.id === o.id), card: (first: boolean) => <WaitlistOfferCard key={o.id} data={data} offer={o} today={today} first={first} /> })),
    ...owed.map((o) => ({ key: o.id, at: o.offers[o.offers.length - 1]?.offeredAt ?? o.createdAt, open: waiting.some((w) => w.id === o.id), card: (first: boolean) => <CancelledCard key={o.id} data={data} owed={o} today={today} first={first} /> })),
    ...fillInsForFamily(data, family.id).map((f) => ({ key: f.id, at: f.offer.answeredAt ?? f.offer.offeredAt, open: waiting.some((w) => w.id === f.id), card: (first: boolean) => <FillInCard key={f.id} data={data} fillIn={f} today={today} first={first} /> })),
  ].sort((a, b) => (a.open !== b.open ? (a.open ? -1 : 1) : a.at < b.at ? 1 : -1));

  return (
    <ScreenShell id="messages">
      <PageTitle>Messages</PageTitle>
      {sent ? (
        <p role="status" className="rounded-card bg-success px-4 py-3 font-strong">
          Sent. A person at the school reads every note.
        </p>
      ) : null}

      {/* The school's offers come first: an answer may be due. */}
      {school.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="from-school">
          <h2 id="from-school" className="font-heading text-big text-heading">
            From the school
          </h2>
          {school.map((s, i) => s.card(i === 0 && s.open))}
        </section>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button size="block" variant={waiting.length > 0 ? "secondary" : "primary"} onClick={() => go("/more/messages/new")}>
          Send a note
        </Button>
        <p>{MESSAGES_LINE}</p>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="your-notes">
        <h2 id="your-notes" className="font-heading text-big text-heading">
          Your notes
        </h2>
        {notes.length === 0 ? <p>No notes yet.</p> : null}
        {notes.map((n) => (
          <article key={n.id} className="flex flex-col gap-2 rounded-card bg-surface p-5 shadow-card" data-testid="family-note">
            <p className="font-strong">{n.words}</p>
            <p>Sent {shownAtSchool(n.sentAt)}</p>
            {n.readAt ? (
              <p className="flex flex-wrap items-center gap-2" data-testid="note-status">
                <Tag tone="mark">Read</Tag>
                <span>Read by the school on {shownAtSchool(n.readAt)}.</span>
              </p>
            ) : (
              <p className="flex flex-wrap items-center gap-2" data-testid="note-status">
                <Tag>Waiting</Tag>
                <span>Waiting for a person to read it.</span>
              </p>
            )}
          </article>
        ))}
      </section>

      <div className="flex items-start gap-3">
        <Tag>SAMPLE</Tag>
        <p>Sample only. No note is really sent, and no one at the pool is told.</p>
      </div>
    </ScreenShell>
  );
}
