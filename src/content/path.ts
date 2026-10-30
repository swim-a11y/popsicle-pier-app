import type { StageId } from "@/data/types";

/** The Path, in order. Families see the stage name only. */
export const PATH_STAGES: readonly { id: StageId; name: string; soundsLike: string }[] = [
  { id: "pier", name: "The Pier", soundsLike: "Just getting started. Likes a grown-up close by in the water." },
  { id: "shallows", name: "The Shallows", soundsLike: "Enjoys the water and is starting to put their face in." },
  { id: "cove", name: "The Cove", soundsLike: "Puts their face in, floats with help and kicks a short way." },
  { id: "open-water", name: "Open Water", soundsLike: "Swims a short way on their own and is working on strokes." },
];

export const NOT_SURE = {
  title: "Not sure? Free evaluation",
  line: "Book a free evaluation. A coach meets your swimmer in the water, then we pick a class together.",
};

export function stageName(id: StageId | null | undefined): string | null {
  return PATH_STAGES.find((s) => s.id === id)?.name ?? null;
}
