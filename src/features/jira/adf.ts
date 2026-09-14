type AdfNode = {
  type?: string;
  text?: string;
  content?: AdfNode[];
};

/** Flatten Atlassian Document Format to plain text. */
export function adfToText(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node !== "object") return "";
  const n = node as AdfNode;
  if (typeof n.text === "string") return n.text;
  const children = Array.isArray(n.content)
    ? n.content.map(adfToText).filter(Boolean)
    : [];
  if (children.length === 0) return "";
  if (
    n.type === "paragraph" ||
    n.type === "heading" ||
    n.type === "blockquote"
  ) {
    return `${children.join("")}\n\n`;
  }
  if (n.type === "listItem") return `- ${children.join("")}\n`;
  if (n.type === "hardBreak") return "\n";
  return children.join("");
}
