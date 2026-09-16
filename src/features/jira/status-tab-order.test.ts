import { describe, expect, it } from "vitest";

import {
  applyStatusTabOrder,
  mergeStatusTabOrder,
  reorderStatusTab,
} from "./status-tab-order";

describe("jira status tab order", () => {
  it("applies saved order and appends unknown statuses", () => {
    const groups = [
      { status: "Done", items: 1 },
      { status: "TODO", items: 2 },
      { status: "In Progress", items: 3 },
    ];
    expect(
      applyStatusTabOrder(groups, ["In Progress", "TODO"]).map((g) => g.status),
    ).toEqual(["In Progress", "TODO", "Done"]);
  });

  it("reorders a status onto another", () => {
    expect(
      reorderStatusTab(
        ["Dev Done", "In Progress", "TODO", "Done"],
        "TODO",
        "Dev Done",
      ),
    ).toEqual(["TODO", "Dev Done", "In Progress", "Done"]);
  });

  it("merges visible order with hidden persisted statuses", () => {
    expect(
      mergeStatusTabOrder(["A", "B", "C", "Hidden"], ["C", "A", "B"]),
    ).toEqual(["C", "A", "B", "Hidden"]);
  });
});
