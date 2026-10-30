"use client";

import { Tag } from "@/components/parts/tag";
import { PageTitle, ScreenShell } from "@/components/shell/screen-shell";
import { LATER_ROOMS, ruleEntriesForRoom, type LaterRoomRule, type RoomId } from "@/rules/later-rooms";

const ROOM_RULES: Record<string, RoomId | null> = {
  schedule: "schedule",
  deck: "deck",
  money: "money",
  "office-owner": "office-owner",
  "progress-video": "progress-video",
  workouts: null,
  "swim-team": null,
};

function RuleItem({ rule }: { rule: LaterRoomRule }) {
  return (
    <li>
      {rule.text}
      {rule.builtIn ? (
        <span className="mt-1 flex flex-wrap items-center gap-2">
          <Tag tone="mark">Built</Tag>
          <span>In {rule.builtIn}.</span>
        </span>
      ) : null}
    </li>
  );
}

/** One page stands in for every staff role: the rooms still to come and the rules each will follow. */
export function StaffScreen() {
  const everyRoom = ruleEntriesForRoom("every-room");
  return (
    <ScreenShell id="staff">
      <div className="flex flex-col gap-3">
        <Tag tone="highlight">Coming later</Tag>
        <PageTitle>Staff side, coming later</PageTitle>
        <p>
          One page stands in for every staff role in this sample, beside the approvals inbox. These are the rooms still to come, what
          each will do, and the rules each one will follow. A rule marked Built already works in this sample.
        </p>
      </div>
      {LATER_ROOMS.map((room) => {
        const ruleRoom = ROOM_RULES[room.id];
        const rules = ruleRoom ? ruleEntriesForRoom(ruleRoom) : [];
        return (
          <section key={room.id} className="flex flex-col gap-3 border-t-2 border-line pt-5" aria-labelledby={`room-${room.id}`}>
            <h2 id={`room-${room.id}`} className="font-heading text-big text-heading">
              {room.name}
            </h2>
            <p>{room.line}</p>
            <h3 className="font-strong text-heading">Rules this room will follow</h3>
            {rules.length > 0 ? (
              <ul className="flex list-disc flex-col gap-2 pl-5">
                {rules.map((r) => (
                  <RuleItem key={r.text} rule={r} />
                ))}
              </ul>
            ) : (
              <p>The rules every room follows, below. Its own rules come when the wing is planned.</p>
            )}
          </section>
        );
      })}
      <section className="flex flex-col gap-3 border-t-2 border-line pt-5" aria-labelledby="room-every">
        <h2 id="room-every" className="font-heading text-big text-heading">
          Every room
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          {everyRoom.map((r) => (
            <RuleItem key={r.text} rule={r} />
          ))}
        </ul>
      </section>
    </ScreenShell>
  );
}
