/** A lane rope: the one bold mark on a screen. Decorative. */
export function LaneLine() {
  return (
    <div
      aria-hidden
      className="h-2.5 w-full rounded-pill bg-[repeating-linear-gradient(90deg,var(--color-mark)_0_14px,var(--color-surface)_14px_18px,var(--color-top-bar)_18px_32px,var(--color-surface)_32px_36px)]"
    />
  );
}
