"use client";

import { NoteCard } from "@/components/parts/note-card";
import { SkeletonRows } from "@/components/parts/skeleton";
import { PageTitle, ScreenShell } from "@/components/shell/screen-shell";
import { Button } from "@/components/ui/button";
import { CLIPS_LATER_LINE } from "@/content/first-lesson";
import { stageName } from "@/content/path";
import { useAppData } from "@/data/use-data";
import { useGo } from "@/lib/nav";
import { longDate } from "@/rules/dates";
import { approvedNotesForFamily, hasHadFirstLesson } from "@/rules/first-sunday";
import { currentFamily, familyChildren, nextLessonPerChild } from "@/rules/family";

/** How it went, newest first. Only approved notes; the family's own children; the stage name only. */
export function ProgressScreen() {
  const loaded = useAppData();
  const go = useGo();
  if (!loaded) {
    return (
      <ScreenShell id="progress">
        <SkeletonRows rows={3} />
      </ScreenShell>
    );
  }
  const { data, today } = loaded;
  const family = currentFamily(data);
  if (!family) {
    return (
      <ScreenShell id="progress">
        <PageTitle>Progress</PageTitle>
        <p>After your swimmer&apos;s first lesson, the coach&apos;s &quot;How it went&quot; note shows up here.</p>
        <Button size="block" onClick={() => go("/sign-up")}>
          Sign up for lessons
        </Button>
      </ScreenShell>
    );
  }
  const kids = familyChildren(data, family.id);
  const notes = approvedNotesForFamily(data, family.id);
  const lessons = nextLessonPerChild(data, family.id, today);

  return (
    <ScreenShell id="progress">
      <PageTitle>Progress</PageTitle>
      <ul className="flex flex-col gap-2" aria-label="Stage on the Path">
        {kids.map((k) => (
          <li key={k.id} className="flex items-center justify-between gap-3 rounded-card bg-surface px-4 py-3 shadow-card">
            <span className="font-strong text-heading">{k.firstName}</span>
            <span>{stageName(k.stageId) ?? "Stage set after the free evaluation"}</span>
          </li>
        ))}
      </ul>
      {kids
        .filter((k) => !hasHadFirstLesson(data, k.id))
        .map((k) => {
          const lesson = lessons.find((l) => l.child.id === k.id);
          return lesson ? (
            <p key={k.id} className="rounded-card bg-surface px-4 py-3 shadow-card" data-testid="note-not-yet">
              Your first &apos;How it went&apos; note comes after {k.firstName}&apos;s first lesson on {longDate(lesson.date, today)}.
            </p>
          ) : null;
        })}
      {notes.length > 0 ? (
        <section className="flex flex-col gap-4" aria-label="How it went">
          {notes.map((n) => (
            <NoteCard key={n.id} data={data} note={n} today={today} />
          ))}
        </section>
      ) : null}
      <p>{CLIPS_LATER_LINE}</p>
    </ScreenShell>
  );
}
