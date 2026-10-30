"use client";

import { useState } from "react";

import { SkeletonRows } from "@/components/parts/skeleton";
import { ChoiceButton } from "@/components/screens/sign-up/shared";
import { PageTitle, ScreenShell } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import { getStore } from "@/data/app-store";
import { newId } from "@/data/ids";
import { useAppData } from "@/data/use-data";
import { useGo, useQueryValue } from "@/lib/nav";
import { clockTime, longDate, todayAtSchool } from "@/rules/dates";
import { currentFamily, familyChildren, familyLessons } from "@/rules/family";
import { missOptions, NOTE_CHOICES, noteWords, sendNote, type NoteKind } from "@/rules/notes";

const BASE = "/more/messages/new";

function href(params: Record<string, string>): string {
  const q = new URLSearchParams(params).toString();
  return q ? `${BASE}?${q}` : BASE;
}

/** A ready-made note: what it's about, which swimmer, which lesson, then the exact words before sending. No free text. */
export function SendNoteScreen() {
  const loaded = useAppData();
  const go = useGo();
  const kindParam = useQueryValue("kind");
  const childParam = useQueryValue("child");
  const date = useQueryValue("date");
  const enrollmentId = useQueryValue("enrollment");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (!loaded || kindParam === undefined) {
    return (
      <ScreenShell id="send-note">
        <SkeletonRows rows={3} />
      </ScreenShell>
    );
  }
  const { data, today } = loaded;
  const family = currentFamily(data);
  const lessons = family ? familyLessons(data, family.id) : [];
  const kids = family ? familyChildren(data, family.id).filter((k) => lessons.some((l) => l.child.id === k.id)) : [];
  if (!family || kids.length === 0) {
    return (
      <ScreenShell id="send-note" backHref="/more/messages">
        <PageTitle>Send a note</PageTitle>
        <p>Once a swimmer has a lesson booked, you can send a note about it here.</p>
        <Button size="block" onClick={() => go(family ? "/" : "/sign-up")}>
          {family ? "Go to Home" : "Sign up for lessons"}
        </Button>
      </ScreenShell>
    );
  }

  const choice = NOTE_CHOICES.find((c) => c.kind === kindParam);
  const kind = choice?.kind as NoteKind | undefined;
  const child = kids.length === 1 ? kids[0] : kids.find((k) => k.id === childParam);
  const options = kind === "miss" && child ? missOptions(data, family.id, child.id, today) : [];
  const picked = options.find((o) => o.date === date && o.enrollmentId === enrollmentId);
  const multiPool = new Set(lessons.filter((l) => l.child.id === child?.id).map((l) => l.pool.id)).size > 1;
  const childStep = (k: NoteKind) => (kids.length > 1 ? href({ kind: k }) : BASE);

  const send = async () => {
    if (busy || !kind || !child) return;
    setBusy(true);
    setProblem(null);
    try {
      const now = new Date();
      await getStore().transaction((tx) =>
        sendNote(tx, { familyId: family.id, childRecordId: child.id, kind, enrollmentId: picked?.enrollmentId ?? null, lessonDate: picked?.date ?? null, today: todayAtSchool(now), now: now.toISOString(), newId }),
      );
      go("/more/messages?sent=1", { replace: true });
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "That didn't send. Please try again.");
      setBusy(false);
    }
  };

  // 1. What it's about.
  if (!kind) {
    return (
      <ScreenShell id="send-note" backHref="/more/messages">
        <PageTitle>What&apos;s the note about?</PageTitle>
        <div className="flex flex-col gap-3">
          {NOTE_CHOICES.map((c) => (
            <ChoiceButton key={c.kind} title={c.title} line={c.line} onClick={() => go(href({ kind: c.kind }))} />
          ))}
        </div>
      </ScreenShell>
    );
  }

  // 2. Which swimmer.
  if (!child) {
    return (
      <ScreenShell id="send-note" backHref={BASE}>
        <PageTitle>Which swimmer?</PageTitle>
        <div className="flex flex-col gap-3">
          {kids.map((k) => (
            <ChoiceButton key={k.id} title={k.firstName} onClick={() => go(href({ kind, child: k.id }))} />
          ))}
        </div>
      </ScreenShell>
    );
  }

  // 3. A miss: which lesson.
  if (kind === "miss" && !picked) {
    return (
      <ScreenShell id="send-note" backHref={childStep(kind)}>
        <PageTitle>Which lesson will {child.firstName} miss?</PageTitle>
        {options.length === 0 ? (
          <p>No lesson dates to pick in the next six weeks.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {options.map((o) => (
              <ChoiceButton
                key={`${o.enrollmentId}-${o.date}`}
                title={longDate(o.date, today)}
                line={multiPool ? `${clockTime(o.startTime)} at ${o.poolName}` : clockTime(o.startTime)}
                testId={`miss-${o.date}`}
                onClick={() => go(href({ kind, child: child.id, date: o.date, enrollment: o.enrollmentId }))}
              />
            ))}
          </div>
        )}
      </ScreenShell>
    );
  }

  // 4. The exact words, then send.
  return (
    <ScreenShell id="send-note" backHref={kind === "miss" ? href({ kind, child: child.id }) : childStep(kind)}>
      <PageTitle>Your note</PageTitle>
      <p className="rounded-card bg-surface px-5 py-4 font-heading text-big text-heading shadow-card" data-testid="note-preview">
        {noteWords(kind, child.firstName, picked?.date ?? null, today)}
      </p>
      <p>A person at the school reads it. Nothing answers automatically.</p>
      {problem ? <p className="rounded-control bg-notice px-4 py-3">{problem}</p> : null}
      <Button size="block" disabled={busy} onClick={() => void send()}>
        {busy ? "Sending..." : "Send this note"}
      </Button>
    </ScreenShell>
  );
}
