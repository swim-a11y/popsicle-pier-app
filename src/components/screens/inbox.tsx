"use client";

import { useState, type ReactNode } from "react";

import { PriceRows } from "@/components/parts/price-rows";
import { SkeletonRows } from "@/components/parts/skeleton";
import { Tag } from "@/components/parts/tag";
import { ChoiceButton } from "@/components/screens/sign-up/shared";
import { PageTitle, ScreenShell } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import { getStore } from "@/data/app-store";
import { newId } from "@/data/ids";
import type { Transaction } from "@/data/store";
import type { AppData, DateOnly, FamilyNote, OwedLesson } from "@/data/types";
import { useAppData } from "@/data/use-data";
import { addDays, clockTime, longDate, shownAtSchool, todayAtSchool, weekdayName } from "@/rules/dates";
import { doneItems, inboxCounts, owedToDo, recordTalk, talkItems, unreadNotes, type TalkItem } from "@/rules/inbox";
import { fillInState, fillInWords, sendFillIn } from "@/rules/fillins";
import { markNoteRead } from "@/rules/notes";
import {
  ANSWER_DAYS,
  BY_THE_SCHOOL,
  classWords,
  differentTimes,
  offerDifferentTime,
  sendWaitlistOffer,
  waitForDifferentTime,
  waitlistItems,
  waitlistOfferWords,
  type WaitlistItem,
} from "@/rules/offers";
import { familyLessons } from "@/rules/family";
import { approveOwedCredit, owedOfferWords, sendOwedOffer, type OwedSlot, type OwedState } from "@/rules/owed";

/** One person's action, saved once (double taps ignored); a problem shows on the card. */
function useAct() {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const act = async (work: (tx: Transaction, today: DateOnly, now: string) => unknown) => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const now = new Date();
      await getStore().transaction((tx) => work(tx, todayAtSchool(now), now.toISOString()));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "That didn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return { busy, problem, act };
}

function Card({ title, sub, testId, children }: { title: ReactNode; sub: ReactNode; testId: string; children: ReactNode }) {
  return (
    <article className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card" data-testid={testId}>
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-big text-heading">{title}</h3>
        <p>{sub}</p>
      </div>
      {children}
    </article>
  );
}

function Problem({ text }: { text: string | null }) {
  return text ? <p className="rounded-control bg-notice px-3 py-2">{text}</p> : null;
}

/** The words the app drafted, shown exactly as the family will see them, then the person sends them. */
function Draft({ words, to, busy, onSend, sendLabel = "Send the offer (sample)" }: { words: string; to: string; busy: boolean; onSend: () => void; sendLabel?: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-control border-2 border-line px-4 py-3" data-testid="draft">
      <p className="font-strong text-heading">Drafted for you to send</p>
      <p data-testid="draft-words">{words}</p>
      <p>Goes to {to}&apos;s Messages in the app.</p>
      <Button size="block" disabled={busy} onClick={onSend}>
        {busy ? "Sending..." : sendLabel}
      </Button>
    </div>
  );
}

function childTitle(data: Readonly<AppData>, childRecordId: string) {
  const child = data.children.find((c) => c.id === childRecordId);
  return (
    <>
      {child?.firstName}
      {child?.childId ? <span className="font-text text-body"> {child.childId}</span> : null}
    </>
  );
}

function familyLine(data: Readonly<AppData>, familyId: string, poolId?: string): string {
  const family = data.families.find((f) => f.id === familyId);
  const pool = poolId ? data.pools.find((p) => p.id === poolId) : undefined;
  return `${family?.parentFullName ?? "A family"}'s family${pool ? `, ${pool.name}` : ""}`;
}

function TalkCard({ data, item, today }: { data: Readonly<AppData>; item: TalkItem; today: DateOnly }) {
  const { busy, problem, act } = useAct();
  const topics = [item.custody ? "the custody question" : null, item.health ? "the health question" : null].filter(Boolean).join(" and ");
  return (
    <Card title={childTitle(data, item.child.id)} sub={familyLine(data, item.family.id)} testId="inbox-talk">
      <p>
        A yes on {topics || "a question"}.{" "}
        {item.next
          ? item.hadFirst
            ? `Their next lesson is ${longDate(item.next.date, today)} at ${item.next.poolName}.`
            : `Their first lesson, ${longDate(item.next.date, today)} at ${item.next.poolName}, waits until someone has talked with the family.`
          : ""}
      </p>
      <p>
        {item.family.confirmedEmail ?? item.family.email}
        <br />
        {item.family.phone}
      </p>
      <Problem text={problem} />
      <Button size="block" disabled={busy} onClick={() => void act((tx, _t, now) => recordTalk(tx, { childRecordId: item.child.id, now, newId, by: BY_THE_SCHOOL }))}>
        {busy ? "Saving..." : "We've talked with the family"}
      </Button>
    </Card>
  );
}

function slotLabel(slot: OwedSlot, today: DateOnly) {
  return `${longDate(slot.date, today)}, ${clockTime(slot.time.startTime)}`;
}

function OwedCard({ data, owed, state, today }: { data: Readonly<AppData>; owed: OwedLesson; state: OwedState; today: DateOnly }) {
  const { busy, problem, act } = useAct();
  const [pick, setPick] = useState<string | null>(null);
  const child = data.children.find((c) => c.id === owed.childRecordId);
  const pool = data.pools.find((p) => p.id === owed.poolId);
  const cancellation = data.cancellations.find((c) => c.id === owed.cancellationId);
  const cls = cancellation ? data.classes.find((c) => c.id === cancellation.classId) : undefined;
  if (!child || !pool) return null;
  const slots = state.kind === "offer" ? state.slots.slice(0, 6) : [];
  const chosen = slots.find((s) => `${s.time.id}|${s.date}` === pick);
  return (
    <Card title={childTitle(data, child.id)} sub={familyLine(data, owed.familyId, owed.poolId)} testId="inbox-owed">
      <p>
        Cancelled {longDate(owed.cancelledDate, today)}
        {cls ? `, ${classWords(cls)}` : ""} with Coach {owed.instructorFirstName}. {cancellation ? `${cancellation.reason}.` : ""}
      </p>
      {state.kind === "offer" ? (
        <>
          <p className="font-strong text-heading">{state.round === 1 ? "Pick one date to offer." : "They said no, or didn't answer. Pick one more date, the last one."}</p>
          <div className="flex flex-col gap-2">
            {slots.map((s) => (
              <ChoiceButton
                outlined
                key={`${s.time.id}|${s.date}`}
                title={slotLabel(s, today)}
                line={s.kind === "evaluation" ? `Coach ${s.time.instructorFirstName}'s private time` : `${classWords(s.time)}, with room that day`}
                selected={pick === `${s.time.id}|${s.date}`}
                testId={`owed-slot-${s.date}-${s.time.startTime.replace(":", "")}`}
                onClick={() => setPick(`${s.time.id}|${s.date}`)}
              />
            ))}
          </div>
          {chosen ? (
            <Draft
              words={owedOfferWords({ childFirstName: child.firstName, owed, slot: chosen, pool, round: state.round, today })}
              to={data.families.find((f) => f.id === owed.familyId)?.parentFullName ?? "the family"}
              busy={busy}
              onSend={() => void act((tx, t, now) => sendOwedOffer(tx, { owedId: owed.id, timeId: chosen.time.id, date: chosen.date, today: t, now }))}
            />
          ) : null}
        </>
      ) : state.kind === "no-opening" ? (
        <>
          <p>
            No opening with Coach {owed.instructorFirstName} within three weeks of {longDate(owed.cancelledDate, today)}. A credit needs the owner&apos;s approval.
          </p>
          <Button size="block" disabled={busy} onClick={() => void act((tx, t, now) => approveOwedCredit(tx, { owedId: owed.id, today: t, now }))}>
            {busy ? "Saving..." : "Approve a credit (owner)"}
          </Button>
        </>
      ) : state.kind === "waiting" ? (
        <p data-testid="inbox-waiting">
          Offered {longDate(state.offer.date, today)}. Waiting for the family&apos;s answer by {longDate(state.offer.answerBy, today)}.
        </p>
      ) : null}
      <Problem text={problem} />
    </Card>
  );
}

function WaitCard({ data, item, today }: { data: Readonly<AppData>; item: WaitlistItem; today: DateOnly }) {
  const { busy, problem, act } = useAct();
  const [pickedClass, setClassId] = useState<string | null>(null);
  // "another" or the enrollment id it's offered in place of. A person chooses; nothing is picked for them.
  const [pickedMode, setMode] = useState<string | null>(null);
  const classId = item.open.length === 1 ? item.open[0].cls.id : pickedClass;
  const mode = item.ownClasses.length === 0 ? "another" : pickedMode;
  const spot = item.open.find((o) => o.cls.id === classId);
  const inPlaceOf = mode && mode !== "another" ? item.ownClasses.find((l) => l.enrollment.id === mode) : undefined;
  const ready = Boolean(spot && mode);
  return (
    <Card title={childTitle(data, item.child.id)} sub={familyLine(data, item.family.id, item.pool.id)} testId="inbox-waitlist">
      <p>Waiting for {item.wanted ? classWords(item.wanted) : "any time that fits"} since {longDate(todayAtSchool(new Date(item.entry.createdAt)), today)}.</p>
      {item.ownClasses.length > 0 ? <p>Has {item.ownClasses.map((l) => classWords(l)).join(" and ")}.</p> : null}
      {item.pending ? (
        <p data-testid="inbox-waiting">
          Offer sent. Waiting for the family&apos;s answer by {longDate(item.pending.answerBy, today)}.
        </p>
      ) : !item.canPay ? (
        <p>This family hasn&apos;t set up how they&apos;ll pay for lessons. Talk with them before offering a spot.</p>
      ) : item.open.length === 0 ? (
        <p>No spot that fits is open yet.</p>
      ) : (
        <>
          {item.open.length > 1 ? (
            <div className="flex flex-col gap-2">
              <p className="font-strong text-heading">Pick the class to offer.</p>
              {item.open.map((o) => (
                <ChoiceButton outlined key={o.cls.id} title={classWords(o.cls)} line={`Coach ${o.cls.instructorFirstName}`} selected={classId === o.cls.id} onClick={() => setClassId(o.cls.id)} />
              ))}
            </div>
          ) : (
            <p className="font-strong text-heading">
              A spot is open in {classWords(item.open[0].cls)}, with Coach {item.open[0].cls.instructorFirstName}.
            </p>
          )}
          {item.ownClasses.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="font-strong text-heading">Offer it as</p>
              <ChoiceButton outlined title="Another class" line="They keep their other classes." selected={mode === "another"} onClick={() => setMode("another")} />
              {item.ownClasses.map((l) => (
                <ChoiceButton
                outlined
                  key={l.enrollment.id}
                  title={`In place of ${classWords(l)}`}
                  line="That class ends when they say yes."
                  selected={mode === l.enrollment.id}
                  onClick={() => setMode(l.enrollment.id)}
                />
              ))}
            </div>
          ) : null}
          {ready && spot ? (
            <Draft
              words={waitlistOfferWords({ child: item.child, cls: spot.cls, pool: item.pool, inPlaceOf: inPlaceOf ?? null, answerBy: addDays(today, ANSWER_DAYS), today })}
              to={item.family.parentFullName}
              busy={busy}
              onSend={() =>
                void act((tx, t, now) => sendWaitlistOffer(tx, { entryId: item.entry.id, classId: spot.cls.id, inPlaceOfEnrollmentId: inPlaceOf?.enrollment.id ?? null, today: t, now, newId }))
              }
            />
          ) : null}
        </>
      )}
      <Problem text={problem} />
    </Card>
  );
}

/**
 * The person's choices for a "different time" note: offer an open time that
 * fits, in place of one of the child's classes, or, when none is open, put
 * the child on the waitlist for any time that fits. Or just read it.
 */
function MoveNoteTools({ data, note, today, busy, act, markRead }: { data: Readonly<AppData>; note: FamilyNote; today: DateOnly; busy: boolean; act: ReturnType<typeof useAct>["act"]; markRead: (label: string) => ReactNode }) {
  const [pick, setPick] = useState<string | null>(null);
  const [replace, setReplace] = useState<string | null>(null);
  const child = data.children.find((c) => c.id === note.childRecordId);
  const family = data.families.find((f) => f.id === note.familyId);
  const times = differentTimes(data, note.childRecordId, today);
  const own = familyLessons(data, note.familyId).filter((l) => l.child.id === note.childRecordId && l.lessonKind !== "evaluation");
  const chosen = times.find((t) => t.cls.id === pick);
  // One class to replace: it's that one. Two or more: the person picks.
  const inPlaceOf = own.length === 1 ? own[0] : own.find((l) => l.enrollment.id === replace);
  if (!child || !family) return markRead("Mark as read");
  if (times.length === 0 || own.length === 0) {
    const pool = own[0]?.pool ?? data.pools.find((p) => p.id === family.homePoolId);
    return (
      <>
        <p>No other time that fits {child.firstName} is open now.</p>
        {pool ? (
          <Button size="block" disabled={busy} onClick={() => void act((tx, _t, now) => waitForDifferentTime(tx, { noteId: note.id, poolId: pool.id, now, newId }))}>
            {busy ? "Saving..." : `Put ${child.firstName} on the ${pool.name} waitlist for any time that fits`}
          </Button>
        ) : null}
        {markRead("Mark as read, no waitlist")}
      </>
    );
  }
  return (
    <>
      <p className="font-strong text-heading">A different time: pick one to offer, or none.</p>
      {own.length === 1 ? (
        <p data-testid="in-place-of">
          This takes the place of {child.firstName}&apos;s class: {weekdayName(own[0].weekday)}s at {clockTime(own[0].startTime)}, {own[0].pool.name}, Coach{" "}
          {own[0].instructorFirstName}. It doesn&apos;t add a class.
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        {times.map((t) => {
          const lt = data.lessonTypes.find((x) => x.id === t.cls.lessonTypeId);
          return (
            <ChoiceButton
              outlined
              key={t.cls.id}
              title={`${weekdayName(t.cls.weekday)}s at ${clockTime(t.cls.startTime)}, ${t.pool.name}`}
              line={`Coach ${t.cls.instructorFirstName}`}
              selected={pick === t.cls.id}
              testId={`different-time-${t.cls.id}`}
              onClick={() => setPick(t.cls.id)}
            >
              {lt ? <PriceRows bankCents={lt.bankDraftCents} /> : null}
              {own.every((l) => l.pool.id !== t.pool.id) ? <Tag>Different pool</Tag> : null}
            </ChoiceButton>
          );
        })}
      </div>
      {chosen && own.length > 1 ? (
        <div className="flex flex-col gap-2">
          <p className="font-strong text-heading">In place of</p>
          {own.map((l) => (
            <ChoiceButton outlined key={l.enrollment.id} title={`${classWords(l)}, ${l.pool.name}`} selected={replace === l.enrollment.id} onClick={() => setReplace(l.enrollment.id)} />
          ))}
        </div>
      ) : null}
      {chosen && inPlaceOf ? (
        <Draft
          words={waitlistOfferWords({ child, cls: chosen.cls, pool: chosen.pool, inPlaceOf, answerBy: addDays(today, ANSWER_DAYS), today, asked: true })}
          to={family.parentFullName}
          busy={busy}
          onSend={() =>
            void act((tx, t, now) => offerDifferentTime(tx, { noteId: note.id, classId: chosen.cls.id, inPlaceOfEnrollmentId: inPlaceOf.enrollment.id, today: t, now, newId }))
          }
        />
      ) : null}
      {markRead("Mark as read, no offer")}
      <p>
        {own.length === 1 ? `${child.firstName} stays in ${classWords(own[0])}.` : `${child.firstName} keeps every class.`} The family sees you read their note.
      </p>
    </>
  );
}

/** A family's note. A "We'll miss" note can get one fill-in (same coach, the week after): a person picks the date, or none. */
function NoteItem({ data, note, today }: { data: Readonly<AppData>; note: FamilyNote; today: DateOnly }) {
  const { busy, problem, act } = useAct();
  const [pick, setPick] = useState<string | null>(null);
  const state = fillInState(data, note, today);
  const slots = state?.kind === "offer" ? state.slots.slice(0, 6) : [];
  const chosen = slots.find((s) => `${s.time.id}|${s.date}` === pick);
  const child = data.children.find((c) => c.id === note.childRecordId);
  const pool = state?.kind === "offer" && chosen ? data.pools.find((p) => p.id === chosen.time.poolId) : undefined;
  const markRead = (label: string) => (
    <Button size="block" variant="secondary" disabled={busy} onClick={() => void act((tx, _t, now) => markNoteRead(tx, { noteId: note.id, now, by: BY_THE_SCHOOL }))}>
      {busy ? "Saving..." : label}
    </Button>
  );
  return (
    <Card title={childTitle(data, note.childRecordId)} sub={familyLine(data, note.familyId)} testId="inbox-note">
      <p className="font-strong" data-testid="inbox-note-words">
        {note.words}
      </p>
      <p>Sent {shownAtSchool(note.sentAt)}</p>
      {state?.kind === "offer" ? (
        <>
          <p className="font-strong text-heading">A fill-in: one date with Coach {state.coach} the week after. Pick one, or none. Once you send it, there&apos;s no second date.</p>
          <div className="flex flex-col gap-2">
            {slots.map((s) => (
              <ChoiceButton
                outlined
                key={`${s.time.id}|${s.date}`}
                title={slotLabel(s, today)}
                line={s.kind === "evaluation" ? `Coach ${s.time.instructorFirstName}'s private time` : `${classWords(s.time)}, with room that day`}
                selected={pick === `${s.time.id}|${s.date}`}
                testId={`fill-in-slot-${s.date}-${s.time.startTime.replace(":", "")}`}
                onClick={() => setPick(`${s.time.id}|${s.date}`)}
              />
            ))}
          </div>
          {chosen && child && pool ? (
            <Draft
              words={fillInWords({ childFirstName: child.firstName, missedDate: note.lessonDate!, slot: chosen, poolName: pool.name, today })}
              to={data.families.find((f) => f.id === note.familyId)?.parentFullName ?? "the family"}
              busy={busy}
              sendLabel="Send the fill-in (sample)"
              onSend={() => void act((tx, t, now) => sendFillIn(tx, { noteId: note.id, timeId: chosen.time.id, date: chosen.date, today: t, now, newId }))}
            />
          ) : null}
          {markRead("Mark as read, no fill-in")}
        </>
      ) : state?.kind === "no-opening" ? (
        <>
          <p>No opening with Coach {state.coach} the week after, so there&apos;s no fill-in to offer.</p>
          {markRead("Mark as read")}
        </>
      ) : state?.kind === "passed" ? (
        <>
          <p>The week after that lesson has passed, so there&apos;s no fill-in to offer.</p>
          {markRead("Mark as read")}
        </>
      ) : note.kind === "move" ? (
        <MoveNoteTools data={data} note={note} today={today} busy={busy} act={act} markRead={markRead} />
      ) : (
        markRead("Mark as read")
      )}
      <Problem text={problem} />
    </Card>
  );
}

function Section({ id, title, count, children }: { id: string; title: string; count: number; children: ReactNode[] }) {
  if (children.length === 0) return null;
  return (
    <section className="flex flex-col gap-3" aria-labelledby={id} data-testid={`inbox-section-${id}`}>
      <h2 id={id} className="flex items-center justify-between gap-2 font-heading text-big text-heading">
        <span>{title}</span>
        {count > 0 ? <Tag tone="mark">{count}</Tag> : null}
      </h2>
      {children}
    </section>
  );
}

/**
 * The approvals inbox (the owner's ruling of October 30, 2026): one page
 * where a person approves each item. The app lists what's waiting and
 * drafts the words; nothing is sent or booked until a person chooses.
 */
export function InboxScreen() {
  const loaded = useAppData();
  if (!loaded) {
    return (
      <ScreenShell id="owner-inbox">
        <SkeletonRows rows={4} />
      </ScreenShell>
    );
  }
  const { data, today } = loaded;
  const counts = inboxCounts(data, today);
  const talks = talkItems(data, today);
  const owed = owedToDo(data, today);
  const waits = waitlistItems(data, today);
  const notes = unreadNotes(data);
  const done = doneItems(data, today);
  const sections = [
    { id: "talks", title: "Talk with a family first", count: counts.talks, items: talks.map((t) => <TalkCard key={t.child.id} data={data} item={t} today={today} />) },
    { id: "owed", title: "Owed lessons", count: counts.owed, items: owed.map((o) => <OwedCard key={o.owed.id} data={data} owed={o.owed} state={o.state} today={today} />) },
    { id: "waitlist", title: "Waitlist", count: counts.waitlist, items: waits.map((w) => <WaitCard key={w.entry.id} data={data} item={w} today={today} />) },
    { id: "notes", title: "Notes from families", count: counts.notes, items: notes.map((n) => <NoteItem key={n.id} data={data} note={n} today={today} />) },
  ];

  return (
    <ScreenShell id="owner-inbox">
      <div className="flex flex-col gap-2">
        <PageTitle>Inbox</PageTitle>
        <p>Nothing is sent or booked until you choose.</p>
      </div>

      {sections.every((s) => s.items.length === 0) ? <p className="rounded-card bg-surface px-4 py-3 shadow-card">Nothing is waiting for a person.</p> : null}
      {sections.map((s) => (
        <Section key={s.id} id={s.id} title={s.title} count={s.count}>
          {s.items}
        </Section>
      ))}

      <section className="flex flex-col gap-3 border-t-2 border-line pt-5" aria-labelledby="done" data-testid="inbox-done">
        <h2 id="done" className="font-heading text-big text-heading">
          Done
        </h2>
        {done.length === 0 ? (
          <p>Nothing yet.</p>
        ) : (
          <ul className="flex list-disc flex-col gap-2 pl-5">
            {done.map((d) => (
              <li key={`${d.at}-${d.line}`}>{d.line}</li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex items-start gap-3">
        <Tag>SAMPLE</Tag>
        <p>Made-up families. Each item waits for a person; the app lists what&apos;s waiting and drafts the words.</p>
      </div>
    </ScreenShell>
  );
}
