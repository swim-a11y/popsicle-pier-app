/** Skeleton rows until stored data loads: never a flash of "nothing here". */
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" className="flex flex-col gap-4" data-testid="skeleton">
      <span className="sr-only">Loading</span>
      <div aria-hidden className="h-9 w-3/4 animate-pulse rounded-control bg-line/25" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden className="h-16 animate-pulse rounded-card bg-line/15" />
      ))}
    </div>
  );
}
