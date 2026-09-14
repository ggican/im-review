export type CompileJqlInput = {
  typeNames: string[];
  labels: string[];
  extraJql: string;
  includeDone: boolean;
};

export function quoteJql(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function extraJqlHasAssignee(extra: string): boolean {
  return /\bassignee\b/i.test(extra);
}

/** Quote hyphenated tokens (ttd-fe-88) so JQL does not treat `-` as minus. */
export function sanitizeJql(jql: string): string {
  return jql.replace(
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b([A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+)\b/g,
    (full, quoted: string | undefined, ident: string | undefined) =>
      quoted ?? (ident ? quoteJql(ident) : full),
  );
}

export function splitOrderBy(jql: string): {
  where: string;
  orderBy: string | null;
} {
  const match = /\bORDER\s+BY\b/i.exec(jql);
  if (!match || match.index == null)
    return { where: jql.trim(), orderBy: null };
  return {
    where: jql.slice(0, match.index).trim(),
    orderBy: jql.slice(match.index).trim().replace(/\s+/g, " "),
  };
}

function typeClauses(typeNames: string[]): string[] {
  const types = typeNames.map((n) => n.trim()).filter(Boolean);
  if (types.length === 1) return [`type = ${quoteJql(types[0]!)}`];
  if (types.length > 1) {
    return [`type IN (${types.map(quoteJql).join(", ")})`];
  }
  return [];
}

function labelClauses(labels: string[]): string[] {
  return labels
    .map((l) => l.trim())
    .filter(Boolean)
    .map((label) => `labels = ${quoteJql(label)}`);
}

export function compileJql(input: CompileJqlInput): string {
  const extra = sanitizeJql(input.extraJql.trim());
  const { where: extraWhere, orderBy: extraOrder } = splitOrderBy(extra);
  const extras = [
    ...typeClauses(input.typeNames),
    ...labelClauses(input.labels),
  ];
  const extraHasAssignee = extraJqlHasAssignee(extraWhere);

  if (extraOrder) {
    const parts = [extraWhere ? `(${extraWhere})` : null, ...extras].filter(
      (p): p is string => Boolean(p),
    );
    return `${parts.join(" AND ")} ${extraOrder}`.trim();
  }

  const parts: string[] = [];
  if (!extraHasAssignee) {
    parts.push("assignee = currentUser()");
    if (!input.includeDone) parts.push("resolution = Unresolved");
  } else if (!input.includeDone && !/\bresolution\b/i.test(extraWhere)) {
    parts.push("resolution = Unresolved");
  }
  parts.push(...extras);
  if (extraWhere) parts.push(`(${extraWhere})`);
  return `${parts.join(" AND ")} ORDER BY updated DESC`;
}

const TYPE_PIN = [
  "Story",
  "Task",
  "Bug",
  "Defect",
  "Sub-task",
  "Subtask",
  "Epic",
];

export function uniqueIssueTypes<T extends { name: string }>(types: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const type of types) {
    const key = type.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(type);
  }
  return out;
}

export function sortIssueTypeNames<T extends { name: string }>(
  types: T[],
): T[] {
  return [...types].sort((a, b) => {
    const ai = TYPE_PIN.findIndex(
      (n) => n.toLowerCase() === a.name.toLowerCase(),
    );
    const bi = TYPE_PIN.findIndex(
      (n) => n.toLowerCase() === b.name.toLowerCase(),
    );
    const ap = ai === -1 ? TYPE_PIN.length : ai;
    const bp = bi === -1 ? TYPE_PIN.length : bi;
    if (ap !== bp) return ap - bp;
    return a.name.localeCompare(b.name);
  });
}
