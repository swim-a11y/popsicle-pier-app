import { Tag } from "@/components/parts/tag";
import { stageName } from "@/content/path";
import type { AppData, LessonNote } from "@/data/types";
import { longDate } from "@/rules/dates";
import { onDeckLine } from "@/rules/first-sunday";
import { lessonInfo } from "@/rules/family";

/** A "How it went" note: the child's own stage name only, no tier, no other child, no clips. */
export function NoteCard({ data, note, today, headingLevel = 2 }: { data: Readonly<AppData>; note: LessonNote; today: string; headingLevel?: 2 | 3 }) {
  const child = data.children.find((c) => c.id === note.childRecordId);
  const pool = data.pools.find((p) => p.id === note.poolId);
  const mark = data.attendanceMarks.find((m) => m.id === note.attendanceMarkId);
  const enrollment = mark ? data.enrollments.find((e) => e.id === mark.enrollmentId) : undefined;
  const info = enrollment ? lessonInfo(data, enrollment) : null;
  const stage = stageName(note.stageId);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  if (!child || note.status !== "approved") return null;
  return (
    <article className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card" data-testid="how-it-went" aria-label={`How it went for ${child.firstName}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tag tone="mark">Sample note</Tag>
        <span>
          {longDate(note.lessonDate, today)}, {pool?.name}
        </span>
      </div>
      <Heading className="font-heading text-big text-heading">How it went for {child.firstName}</Heading>
      <p>
        <span className="font-strong">Coach {note.instructorFirstName}</span>
        {stage ? <span data-testid="note-stage">, {stage}</span> : <span>, free evaluation</span>}
      </p>
      <div className="flex flex-col gap-2 border-l-4 border-mark pl-4" data-testid="coach-lines">
        <p>{note.lineToday}</p>
        <p>{note.lineNext}</p>
      </div>
      <p data-testid="on-deck">{onDeckLine(mark, child.firstName, Boolean(info?.parentInWater))}</p>
      <p>Approved by Coach {note.approvedBy}</p>
    </article>
  );
}
