import { cn } from "@/lib/cn";

/** Star icon fill/color when favorited — uses warning semantic tokens. */
export function favoriteStarClass(active: boolean, className?: string): string {
  return cn(active && "fill-warning text-warning", className);
}

/** Filled favorite toggle button (e.g. Favorite branch). */
export function favoriteToggleButtonClass(
  active: boolean,
  className?: string,
): string {
  return cn(
    active &&
      "border-warning bg-warning-container text-on-warning-container hover:bg-warning-container/80",
    className,
  );
}
