import type { CoachLineTemplate } from "@/data/types";

/*
  SAMPLE coach lines: one thing the child did today, one thing to work on
  next. [name] is the child's first name. No promises, no ranking, no
  comparing.
*/
const lines: [CoachLineTemplate["stageId"], string, string][] = [
  ["pier", "Today [name] blew bubbles with their face in the water and kicked across the step with help.", "Next we'll work on floating on their back."],
  ["pier", "Today [name] sat on the step and splashed with their feet to warm up.", "Next we'll work on getting their chin wet."],
  ["pier", "Today [name] held the wall and moved hand over hand along it.", "Next we'll work on kicking while holding the wall."],
  ["pier", "Today [name] poured a cup of water over their own head.", "Next we'll work on blowing bubbles at the surface."],
  ["pier", "Today [name] walked a toy boat along the step and reached for it.", "Next we'll work on a short glide to the coach."],
  ["pier", "Today [name] dipped their hands in and waved hello to the water.", "Next we'll work on sitting on the step a little longer."],
  ["shallows", "Today [name] put their face in and blew bubbles for a count of three.", "Next we'll work on a back float with the coach's hand under them."],
  ["shallows", "Today [name] kicked to the coach holding a noodle.", "Next we'll work on kicking with their face in the water."],
  ["shallows", "Today [name] floated on their back with support.", "Next we'll work on rolling from front to back."],
  ["shallows", "Today [name] jumped in from the edge to the coach.", "Next we'll work on turning back to the wall."],
  ["shallows", "Today [name] picked a ring up from the step.", "Next we'll work on going under for a moment."],
  ["shallows", "Today [name] glided to the coach with their arms out.", "Next we'll work on a longer glide."],
  ["cove", "Today [name] floated on their back for a count of five.", "Next we'll work on rolling over to take a breath."],
  ["cove", "Today [name] kicked across the lane with a kickboard.", "Next we'll work on big arms with the kick."],
  ["cove", "Today [name] went under and came back up to the wall.", "Next we'll work on turning to the wall on their own."],
  ["cove", "Today [name] swam a few strokes to the coach.", "Next we'll work on a steady kick from the hips."],
  ["cove", "Today [name] jumped in, turned and reached the wall.", "Next we'll work on doing it twice in a row."],
  ["cove", "Today [name] practiced side breathing with a kickboard.", "Next we'll work on breathing without stopping."],
  ["open-water", "Today [name] swam freestyle across the lane with side breaths.", "Next we'll work on a longer reach with each arm."],
  ["open-water", "Today [name] practiced backstroke with a steady kick.", "Next we'll work on keeping their hips up."],
  ["open-water", "Today [name] treaded water for a short count.", "Next we'll work on treading a little longer."],
  ["open-water", "Today [name] swam to the wall and pushed off again.", "Next we'll work on a smooth turn."],
  ["open-water", "Today [name] worked on breaststroke kicks with a board.", "Next we'll work on timing the arms with the kick."],
  ["open-water", "Today [name] swam two lengths with rests at the wall.", "Next we'll work on fewer stops."],
  ["evaluation", "Today [name] met the coach and got comfortable in the water.", "Next we'll talk with you about the class that fits."],
  ["evaluation", "Today [name] showed the coach how they like to move in the water.", "Next we'll pick a time and a class together."],
  ["evaluation", "Today [name] splashed, kicked and floated with the coach close by.", "Next we'll find the class that fits and a time that works."],
];

export const COACH_LINE_TEMPLATES: CoachLineTemplate[] = lines.map(([stageId, today, next], i) => ({
  id: `coach-line-${String(i + 1).padStart(2, "0")}`,
  stageId,
  today,
  next,
}));
