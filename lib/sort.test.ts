import { describe, expect, it } from "vitest";
import type { Task } from "@/types";
import { isOverdue, sortActive, sortDone, todayISODate } from "@/lib/sort";

const NOW = new Date("2026-07-10T12:00:00Z");

function task(overrides: Partial<Task>): Task {
  return {
    id: "id",
    title: "Task",
    status: "active",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    source: "manual",
    ...overrides,
  };
}

describe("todayISODate", () => {
  it("formats a date as YYYY-MM-DD in local time", () => {
    expect(todayISODate(new Date(2026, 6, 5))).toBe("2026-07-05");
  });
});

describe("isOverdue", () => {
  it("is true for an active task with a past deadline", () => {
    expect(isOverdue(task({ deadline: "2026-07-09" }), NOW)).toBe(true);
  });

  it("is false when the deadline is today", () => {
    expect(isOverdue(task({ deadline: "2026-07-10" }), NOW)).toBe(false);
  });

  it("is false for a future deadline", () => {
    expect(isOverdue(task({ deadline: "2026-07-20" }), NOW)).toBe(false);
  });

  it("is false when there is no deadline", () => {
    expect(isOverdue(task({}), NOW)).toBe(false);
  });

  it("is false for a done task even if the deadline passed", () => {
    expect(
      isOverdue(task({ status: "done", deadline: "2026-07-01" }), NOW),
    ).toBe(false);
  });
});

describe("sortActive", () => {
  it("orders overdue, then nearest deadline, then no deadline, newest first", () => {
    const overdue = task({ id: "overdue", deadline: "2026-07-05" });
    const soon = task({ id: "soon", deadline: "2026-07-12" });
    const later = task({ id: "later", deadline: "2026-07-25" });
    const noDeadlineOld = task({
      id: "old",
      createdAt: "2026-07-01T00:00:00.000Z",
    });
    const noDeadlineNew = task({
      id: "new",
      createdAt: "2026-07-08T00:00:00.000Z",
    });

    const sorted = sortActive(
      [later, noDeadlineOld, overdue, noDeadlineNew, soon],
      NOW,
    );

    expect(sorted.map((t) => t.id)).toEqual([
      "overdue",
      "soon",
      "later",
      "new",
      "old",
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [task({ id: "a" }), task({ id: "b" })];
    const copy = [...input];
    sortActive(input, NOW);
    expect(input).toEqual(copy);
  });
});

describe("sortDone", () => {
  it("orders newest completed first", () => {
    const a = task({
      id: "a",
      status: "done",
      completedAt: "2026-07-02T00:00:00.000Z",
    });
    const b = task({
      id: "b",
      status: "done",
      completedAt: "2026-07-09T00:00:00.000Z",
    });
    const c = task({
      id: "c",
      status: "done",
      completedAt: "2026-07-05T00:00:00.000Z",
    });

    expect(sortDone([a, b, c]).map((t) => t.id)).toEqual(["b", "c", "a"]);
  });
});
