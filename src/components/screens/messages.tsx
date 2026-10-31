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
import type { AppData, DateOnly, FamilyNote, FillIn, OwedLesson, PartnerNotice, WaitlistOffer } from "@/data/types";
import { useAppData } from "@/data/use-data";
import { useGo, useQueryValue } from "@/lib/nav";
import { firstWeeklyDate } from "@/rules/closures";
import { clockTime, longDate, shownAtSchool, todayAtSchool, weekdayName } from "@/rules/dates";
import { closedBeforeAnswer, currentFamily, familyLessons, fillInOpen, lessonInfo, oneOffGone, oneOffOfFillIn, oneOffOfOwed, type OneOffGone } from "@/rules/family";
import { answerFillIn, fillInsForFamily } from "@/rules/fillins";
import { offerOpen } from "@/rules/holds";
import { notesForFamily } from "@/rules/notes";
import { answerWaitlistOffer, classFullWords, offersForFamily } from "@/rules/offers";
import { answerOwedOffer, answersWaiting, owedForFamily, owedState } from "@/rules/owed";
import { partnerNoticeNow, partnerNoticesForFamily } from "@/rules/partners";

function AnswerButtons({ yes, no = "No, thanks", onAnswer, busy }: { yes: string; no?: string; onAnswer: (answer: "yes" | "no") => void; busy: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <Button size="block" disabled={busy} onClick={() => onAnswer("yes")}>
        {busy ? "Saving..." : yes}
      </Button>
      <Button variant="secondary" size="block" disabled={busy} onClick={() => onAnswer("no")}>
        {no}
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

/** Why an earlier date offered closed before the family answered, if the school cancelled or closed its day. */
function goneShort(gone: OneOffGone | null): string {
  return gone?.kind === "cancelled" ? "we cancelled that day, so it closed." : gone?.kind === "closed" ? "the pool is closed that day, so it closed." : "";
}

/** What the school did about a note it has read, if anything shows it: an offer above, a fill-in above, or a waitlist. */
function noteOutcome(data: Readonly<AppData>, note: FamilyNote): string {
  const name = data.children.find((c) => c.id === note.childRecordId)?.firstName ?? "";
  if (data.waitlistOffers.some((o) => o.fromNoteId === note.id)) return "The school offered a different time, above.";
  if (data.fillIns.some((f) => f.noteId === note.id)) return "The school offered a fill-in, above.";
  const entry = data.waitlistEntries.find((w) => w.fromNoteId === note.id);
  const pool = entry ? data.pools.find((p) => p.id === entry.poolId) : undefined;
  if (pool) return `${name} is on the ${pool.name} waitlist for any time that fits.`;
  if (note.kind === "miss") return "There's no fill-in for this one.";
  return "";
}

/** "on Friday, October 30": when a family answered. */
function answeredOn(at: string | null, today: DateOnly): string {
  return at ? ` on ${longDate(todayAtSchool(new Date(at)), today)}` : "";
}

function WaitlistOfferCard({ data, offer, today, first }: { data: Readonly<AppData>; offer: WaitlistOffer; today: DateOnly; first: boolean }) {
  const { busy, problem, answer } = useAnswer();
  const child = data.children.find((c) => c.id === offer.childRecordId);
  const cls = data.classes.find((c) => c.id === offer.classId);
  const pool = data.pools.find((p) => p.id === offer.poolId);
  const lt = cls ? data.lessonTypes.find((l) => l.id === cls.lessonTypeId) : undefined;
  const booked = offer.enrollmentId ? data.enrollments.find((e) => e.id === offer.enrollmentId) : undefined;
  // The class it takes the place of, if a person offered it as a switch (kept with its end date once it's done).
  const was = offer.inPlaceOfEnrollmentId ? data.enrollments.find((e) => e.id === offer.inPlaceOfEnrollmentId) : undefined;
  const wasInfo = was ? lessonInfo(data, was) : null;
  // Only while the family hasn't left that waitlist themselves.
  const stays = data.waitlistEntries.some((w) => w.id === offer.waitlistEntryId) ? ` ${child?.firstName} stays on the waitlist.` : "";
  const open = offerOpen(offer, today);
  if (!child || !cls || !pool) return null;
  const starts = firstWeeklyDate(data, cls, pool, today);
  const name = child.firstName;
  // For a switch: the child's other classes, which a yes leaves as they are.
  const staying = wasInfo ? familyLessons(data, offer.familyId).filter((l) => l.child.id === child.id && l.lessonKind !== "evaluation" && l.enrollment.id !== wasInfo.enrollment.id) : [];
  return (
    <article className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card" aria-labelledby={`offer-${offer.id}`} data-testid="school-offer">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`offer-${offer.id}`} className="font-heading text-big text-heading">
          {offer.fromNoteId && offer.inPlaceOfEnrollmentId ? `A different time for ${name}` : `A spot for ${name}`}
        </h3>
        {open ? <Tag tone={first ? "highlight" : "plain"}>Needs your answer</Tag> : null}
      </div>
      {open ? (
        <>
          <p data-testid="offer-words">{offer.words}</p>
          {wasInfo && lt ? (
            <dl className="flex flex-col gap-3" data-testid="now-and-new">
              <div className="flex flex-col gap-1">
                <dt className="font-strong text-heading">Now</dt>
                <dd className="flex flex-col gap-1">
                  <span className="font-strong">
                    {weekdayName(wasInfo.weekday)}s at {clockTime(wasInfo.startTime)}, {wasInfo.pool.name}, Coach {wasInfo.instructorFirstName}
                  </span>
                  {/* Its prices show here only when New's differ; otherwise New says "Same as now." */}
                  {wasInfo.bankCents !== null && wasInfo.bankCents !== lt.bankDraftCents ? <PriceRows bankCents={wasInfo.bankCents} /> : null}
                  <span>Ends the day you say yes.</span>
                </dd>
              </div>
              <div className="flex flex-col gap-1 border-t border-line pt-3">
                <dt className="font-strong text-heading">New</dt>
                <dd className="flex flex-col gap-1 border-l-4 border-mark pl-4">
                  <span className="font-strong">
                    {weekdayName(cls.weekday)}s at {clockTime(cls.startTime)}, {pool.name}, Coach {cls.instructorFirstName}
                  </span>
                  <PriceRows bankCents={lt.bankDraftCents} />
                  {wasInfo.bankCents === lt.bankDraftCents ? <span>Same as now.</span> : null}
                </dd>
              </div>
            </dl>
          ) : lt ? (
            <PriceRows bankCents={lt.bankDraftCents} />
          ) : null}
          {staying.length > 0 ? (
            <p data-testid="others-stay">
              {staying.map((l) => `${name}'s ${weekdayName(l.weekday)} ${clockTime(l.startTime)} class at ${l.pool.name} stays as it is.`).join(" ")}
            </p>
          ) : null}
          <p>If you say yes today, the first lesson there is {longDate(starts, today)}.</p>
          <AnswerButtons
            yes={wasInfo ? `Yes, move ${name}` : "Yes, book it"}
            no={wasInfo ? `No, keep ${name}'s class` : "No, thanks"}
            busy={busy}
            onAnswer={(a) =>
              void answer((t, now) => (tx) => answerWaitlistOffer(tx, { offerId: offer.id, familyId: offer.familyId, answer: a, today: t, now, newId }))
            }
          />
        </>
      ) : offer.answer === "yes" ? (
        <p className="rounded-control bg-success px-3 py-2" data-testid="offer-status">
          You said yes{answeredOn(offer.answeredAt, today)}. {name}&apos;s first lesson in {classFullWords(cls, pool.name)}, is{" "}
          {booked ? longDate(booked.firstLessonDate, today) : "coming up"}.
          {wasInfo ? ` ${name}'s ${weekdayName(wasInfo.weekday)} ${clockTime(wasInfo.startTime)} class at ${wasInfo.pool.name} has ended.` : ""}
        </p>
      ) : offer.answer === "no" ? (
        <p data-testid="offer-status">
          You said no, thanks{answeredOn(offer.answeredAt, today)}.{wasInfo ? ` ${name} keeps the class now.` : ""}
          {stays}
        </p>
      ) : (
        <p data-testid="offer-status">
          No answer by {longDate(offer.answerBy, today)}, so this offer closed.{stays}
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
  const bookedGone = state.kind === "booked" ? oneOffGone(data, oneOffOfOwed(owed, state.offer)) : null;
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
            {longDate(o.date, today)} at {clockTime(timeOf(o))}: {o.answer === "no" ? "you said no, thanks." : goneShort(closedBeforeAnswer(data, oneOffOfOwed(owed, o))) || "no answer in time."}
          </p>
        ))}
      {state.kind === "waiting" ? (
        <>
          <p data-testid="offer-words">{state.offer.words}</p>
          <AnswerButtons yes="Yes, that works" busy={busy} onAnswer={(a) => void answer((t, now) => (tx) => answerOwedOffer(tx, { owedId: owed.id, familyId: owed.familyId, answer: a, today: t, now }))} />
        </>
      ) : state.kind === "booked" && bookedGone ? (
        <p data-testid="offer-status">
          You said yes{answeredOn(state.offer.answeredAt, today)} to {longDate(state.offer.date, today)} at {clockTime(timeOf(state.offer))}.{" "}
          {bookedGone.kind === "cancelled" ? `We cancelled that day too. ${bookedGone.reason}.` : bookedGone.kind === "closed" ? `The pool is closed that day. ${bookedGone.reason}.` : ""}
        </p>
      ) : state.kind === "booked" ? (
        <p className="rounded-control bg-success px-3 py-2" data-testid="offer-status">
          You said yes{answeredOn(state.offer.answeredAt, today)}. {child.firstName}&apos;s lesson is on {longDate(state.offer.date, today)} at {clockTime(timeOf(state.offer))} at {pool.name},
          with Coach {owed.instructorFirstName}.
        </p>
      ) : state.kind === "closed" ? (
        <p data-testid="offer-status">Neither date worked, so this one is closed. It stays on your bill.</p>
      ) : state.kind === "credited" ? (
        <p className="rounded-control bg-success px-3 py-2" data-testid="offer-status">
          No date with Coach {owed.instructorFirstName} was open, so the owner approved a credit. The lesson on {longDate(owed.billedDate, today)} comes off your bill.
        </p>
      ) : state.kind === "class-ended" ? (
        <p data-testid="offer-status">
          {child.firstName}&apos;s class there ended before this lesson, so it isn&apos;t on your bill, and no new date is owed.
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
  const open = fillInOpen(data, fillIn, today);
  // Its day cancelled or closed, or its class ended, after it was offered; for one not answered, only while it was still open.
  const gone = o.answer === null ? closedBeforeAnswer(data, oneOffOfFillIn(fillIn)) : oneOffGone(data, oneOffOfFillIn(fillIn));
  const poolName = data.pools.find((p) => p.id === fillIn.poolId)?.name ?? "";
  const stoodFor = data.enrollments.find((e) => e.id === fillIn.enrollmentId);
  const wasClass = stoodFor ? lessonInfo(data, stoodFor) : null;
  if (!child) return null;
  const goneWhy =
    gone?.kind === "cancelled"
      ? `We cancelled that day. ${gone.reason}.`
      : gone?.kind === "closed"
        ? `The pool is closed that day. ${gone.reason}.`
        : gone?.kind === "class-ended" && wasClass
          ? `It ended with ${child.firstName}'s ${weekdayName(wasClass.weekday)} ${clockTime(wasClass.startTime)} class.`
          : "";
  return (
    <article className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card" aria-labelledby={`fill-in-${fillIn.id}`} data-testid="school-fill-in">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`fill-in-${fillIn.id}`} className="font-heading text-big text-heading">
          A fill-in for {child.firstName}
        </h3>
        {open ? <Tag tone={first ? "highlight" : "plain"}>Needs your answer</Tag> : null}
      </div>
      {open ? (
        <>
          <p data-testid="offer-words">{o.words}</p>
          <AnswerButtons yes="Yes, that works" busy={busy} onAnswer={(a) => void answer((t, now) => (tx) => answerFillIn(tx, { fillInId: fillIn.id, familyId: fillIn.familyId, answer: a, today: t, now }))} />
        </>
      ) : o.answer === "yes" && gone ? (
        <p data-testid="offer-status">
          You said yes{answeredOn(o.answeredAt, today)} to a fill-in on {longDate(o.date, today)} at {clockTime(time)}. {goneWhy}
        </p>
      ) : o.answer === "yes" ? (
        <p className="rounded-control bg-success px-3 py-2" data-testid="offer-status">
          You said yes{answeredOn(o.answeredAt, today)}. {child.firstName}&apos;s fill-in is on {longDate(o.date, today)} at {clockTime(time)} at {poolName}, with Coach{" "}
          {fillIn.instructorFirstName}, for the lesson on {longDate(fillIn.missedDate, today)}.
        </p>
      ) : o.answer === "no" ? (
        <p data-testid="offer-status">
          You said no, thanks{answeredOn(o.answeredAt, today)}, to a fill-in on {longDate(o.date, today)}. The lesson on {longDate(fillIn.missedDate, today)} has no fill-in.
        </p>
      ) : (
        <p data-testid="offer-status">
          We offered a fill-in on {longDate(o.date, today)} for the lesson on {longDate(fillIn.missedDate, today)}.{" "}
          {gone ? `It closed before you answered. ${goneWhy}` : `No answer by ${longDate(o.answerBy, today)}, so it closed.`}
        </p>
      )}
      {problem ? <p className="rounded-control bg-notice px-3 py-2">{problem}</p> : null}
    </article>
  );
}

/** The school's note about a semi-private class with no partner after its first month. Nothing to answer; it opens a talk. */
function PartnerNoticeCard({ data, notice, today }: { data: Readonly<AppData>; notice: PartnerNotice; today: DateOnly }) {
  const child = data.children.find((c) => c.id === notice.childRecordId);
  if (!child) return null;
  const now = partnerNoticeNow(data, notice);
  return (
    <article className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card" aria-labelledby={`partner-${notice.id}`} data-testid="school-partner-note">
      <h3 id={`partner-${notice.id}`} className="font-heading text-big text-heading">
        About {child.firstName}&apos;s class
      </h3>
      <p className="whitespace-pre-line" data-testid="partner-note-words">
        {notice.words}
      </p>
      <p>Sent {shownAtSchool(notice.sentAt)}</p>
      {now.kind === "partner" ? <p data-testid="partner-note-status">A partner has joined that class since.</p> : null}
      {now.kind === "restarted" ? (
        <p data-testid="partner-note-status">A partner joined that class and then left, so the first month started again on {longDate(now.since, today)}.</p>
      ) : null}
      {now.kind === "ended" ? <p data-testid="partner-note-status">That class has since ended for {child.firstName}.</p> : null}
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
    ...partnerNoticesForFamily(data, family.id).map((n) => ({ key: n.id, at: n.sentAt, open: false, card: () => <PartnerNoticeCard key={n.id} data={data} notice={n} today={today} /> })),
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
                <span>
                  Read by the school on {shownAtSchool(n.readAt)}.{noteOutcome(data, n) ? ` ${noteOutcome(data, n)}` : ""}
                </span>
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
