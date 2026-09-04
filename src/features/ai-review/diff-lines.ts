/** Parse unified-diff patch → file line numbers commentable on the RIGHT (new) side. */
export function rightSideLinesFromPatch(patch: string): number[] {
  const lines: number[] = [];
  let newLine = 0;
  for (const raw of patch.split("\n")) {
    if (raw.startsWith("@@")) {
      const m = raw.match(/\+(\d+)(?:,(\d+))?/);
      if (m) newLine = Number.parseInt(m[1]!, 10);
      continue;
    }
    if (raw.startsWith("\\")) continue;
    if (raw.startsWith("-")) continue;
    if (raw.startsWith("+") || raw.startsWith(" ")) {
      lines.push(newLine);
      newLine += 1;
    }
  }
  return lines;
}

/** Prefer exact line; otherwise nearest commentable line within maxDistance. */
export function snapToCommentableLine(
  desired: number,
  commentable: number[],
  maxDistance = 40,
): number | null {
  if (commentable.length === 0) return null;
  if (commentable.includes(desired)) return desired;
  let best = commentable[0]!;
  let bestDist = Math.abs(desired - best);
  for (const n of commentable) {
    const d = Math.abs(desired - n);
    if (d < bestDist) {
      best = n;
      bestDist = d;
    }
  }
  return bestDist <= maxDistance ? best : null;
}

export function normalizeReviewPath(path: string): string {
  return path.trim().replace(/^\.\//, "").replace(/\\/g, "/");
}
