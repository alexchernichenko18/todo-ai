import { describe, expect, it } from "vitest";
import type { Task } from "@/types";
import {
  initialActiveOrder,
  isOverdue,
  sortActive,
  sortDone,
  todayISODate,
} from "@/lib/sort";

const NOW = new Date("2026-07-10T12:00:00Z");

function task(overrides: Partial<Task>): Task {
  return {
    id: "id",
    title: "Task",
    status: "active",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    source: "manual",
    subtasks: [],
    order: 0,
    edited: false,
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

  it("is false for a done task even if the deadline passed", () => {
    expect(
      isOverdue(task({ status: "done", deadline: "2026-07-01" }), NOW),
    ).toBe(false);
  });
});

describe("sortActive", () => {
  it("orders by the manual order field ascending", () => {
    const a = task({ id: "a", order: 2 });
    const b = task({ id: "b", order: 0 });
    const c = task({ id: "c", order: 1 });
    expect(sortActive([a, b, c]).map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("breaks ties on equal order by newest first", () => {
    const older = task({
      id: "older",
      order: 0,
      createdAt: "2026-07-01T00:00:00.000Z",
    });
    const newer = task({
      id: "newer",
      order: 0,
      createdAt: "2026-07-05T00:00:00.000Z",
    });
    expect(sortActive([older, newer]).map((t) => t.id)).toEqual([
      "newer",
      "older",
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [task({ id: "a", order: 1 }), task({ id: "b", order: 0 })];
    const copy = [...input];
    sortActive(input);
    expect(input).toEqual(copy);
  });
});

describe("initialActiveOrder", () => {
  it("orders overdue, then nearest deadline, then no deadline", () => {
    const overdue = task({ id: "overdue", deadline: "2026-07-05" });
    const soon = task({ id: "soon", deadline: "2026-07-12" });
    const none = task({ id: "none" });
    expect(
      initialActiveOrder([none, soon, overdue], NOW).map((t) => t.id),
    ).toEqual(["overdue", "soon", "none"]);
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
    expect(sortDone([a, b]).map((t) => t.id)).toEqual(["b", "a"]);
  });
});
