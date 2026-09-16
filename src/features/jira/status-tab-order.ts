/** Apply a saved status order; unknown statuses keep their relative default order at the end. */
export function applyStatusTabOrder<T extends { status: string }>(
  groups: T[],
  order: string[],
): T[] {
  if (order.length === 0 || groups.length <= 1) return groups;
  const byStatus = new Map(groups.map((group) => [group.status, group]));
  const result: T[] = [];
  const seen = new Set<string>();
  for (const status of order) {
    const group = byStatus.get(status);
    if (!group) continue;
    result.push(group);
    seen.add(status);
  }
  for (const group of groups) {
    if (!seen.has(group.status)) result.push(group);
  }
  return result;
}

/** Move `from` before/onto `to` within an ordered status list. */
export function reorderStatusTab(
  order: string[],
  from: string,
  to: string,
): string[] {
  if (from === to) return order;
  const next = [...order];
  const fromIdx = next.indexOf(from);
  const toIdx = next.indexOf(to);
  if (fromIdx < 0 || toIdx < 0) return order;
  next.splice(fromIdx, 1);
  next.splice(toIdx, 0, from);
  return next;
}

/**
 * Merge a visible reordered list into the persisted order, keeping
 * statuses that are not currently visible.
 */
export function mergeStatusTabOrder(
  previous: string[],
  visibleOrdered: string[],
): string[] {
  const visible = new Set(visibleOrdered);
  const rest = previous.filter((status) => !visible.has(status));
  return [...visibleOrdered, ...rest];
}
