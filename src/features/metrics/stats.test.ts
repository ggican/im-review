import { describe, expect, it } from "vitest";

import {
  aggregate,
  aggregationLabel,
  average,
  percentile,
  scoreTrend,
} from "./stats";
import { windowPresetDays } from "./types";

describe("UNIT-METRICS-001 average", () => {
  it("returns 0 for empty", () => {
    expect(average([])).toBe(0);
  });

  it("averages numbers", () => {
    expect(average([2, 4, 6])).toBe(4);
  });
});

describe("UNIT-METRICS-002 percentile", () => {
  it("returns the only value", () => {
    expect(percentile([10], 0.5)).toBe(10);
  });

  it("interpolates between ranks", () => {
    expect(percentile([0, 10], 0.5)).toBe(5);
  });

  it("returns endpoints", () => {
    const sorted = [1, 2, 3, 4];
    expect(percentile(sorted, 0)).toBe(1);
    expect(percentile(sorted, 1)).toBe(4);
  });
});

describe("UNIT-METRICS-003 aggregate", () => {
  it("returns null for empty", () => {
    expect(aggregate([], "avg")).toBeNull();
  });

  it("supports avg and percentiles", () => {
    const values = [10, 20, 30, 40];
    expect(aggregate(values, "avg")).toBe(25);
    expect(aggregate(values, "p50")).toBe(25);
    expect(aggregate(values, "p75")).toBeGreaterThanOrEqual(25);
    expect(aggregate(values, "p90")).toBeGreaterThan(30);
    expect(aggregate(values, "p95")).toBeGreaterThan(30);
    expect(aggregate(values, "p99")).toBeGreaterThan(30);
  });
});

describe("UNIT-METRICS-004 aggregationLabel", () => {
  it("maps all modes", () => {
    expect(aggregationLabel("avg")).toBe("avg");
    expect(aggregationLabel("p50")).toBe("p50");
    expect(aggregationLabel("p75")).toBe("p75");
    expect(aggregationLabel("p90")).toBe("p90");
    expect(aggregationLabel("p95")).toBe("p95");
    expect(aggregationLabel("p99")).toBe("p99");
  });
});

describe("UNIT-METRICS-005 scoreTrend", () => {
  it("handles missing previous", () => {
    expect(scoreTrend(80, null)).toEqual({
      current: 80,
      previous: null,
      pct: null,
    });
  });

  it("handles previous zero", () => {
    expect(scoreTrend(50, 0).pct).toBe(100);
    expect(scoreTrend(0, 0).pct).toBe(0);
  });

  it("computes percent change", () => {
    expect(scoreTrend(120, 100).pct).toBeCloseTo(20);
  });
});

describe("UNIT-METRICS-014 windowPresetDays", () => {
  it("maps presets", () => {
    expect(windowPresetDays("today")).toBe(1);
    expect(windowPresetDays("7")).toBe(7);
    expect(windowPresetDays("14")).toBe(14);
    expect(windowPresetDays("30")).toBe(30);
  });
});
