import { describe, expect, it } from "vitest";
import type { Category, Task } from "@/types";
import {
  initialTasksState,
  tasksReducer,
  type TasksState,
} from "@/lib/tasks-reducer";

function baseTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
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

function stateWith(tasks: Task[], categories: Category[] = []): TasksState {
  return { tasks, categories, activeTab: "active", ready: true };
}

describe("tasksReducer", () => {
  it("HYDRATE loads state and marks it ready", () => {
    const next = tasksReducer(initialTasksState, {
      type: "HYDRATE",
      payload: { tasks: [baseTask()], categories: [], activeTab: "done" },
    });
    expect(next.ready).toBe(true);
    expect(next.tasks).toHaveLength(1);
    expect(next.activeTab).toBe("done");
  });

  it("ADD_TASK places the new task on top (min order - 1)", () => {
    const existing = baseTask({ id: "a", order: 0 });
    const next = tasksReducer(stateWith([existing]), {
      type: "ADD_TASK",
      task: baseTask({ id: "new", order: 999 }),
    });
    const added = next.tasks.find((t) => t.id === "new");
    expect(added?.order).toBe(-1);
  });

  it("UPDATE_TASK applies the patch, bumps timestamp and marks edited", () => {
    const next = tasksReducer(stateWith([baseTask()]), {
      type: "UPDATE_TASK",
      id: "t1",
      patch: { title: "Renamed" },
      updatedAt: "2026-07-05T00:00:00.000Z",
    });
    expect(next.tasks[0].title).toBe("Renamed");
    expect(next.tasks[0].edited).toBe(true);
  });

  it("COMPLETE_TASK does not mark the task as edited", () => {
    const next = tasksReducer(stateWith([baseTask()]), {
      type: "COMPLETE_TASK",
      id: "t1",
      completedAt: "2026-07-06T00:00:00.000Z",
      updatedAt: "2026-07-06T00:00:00.000Z",
    });
    expect(next.tasks[0].status).toBe("done");
    expect(next.tasks[0].edited).toBe(false);
  });

  it("RESTORE_TASK reactivates, clears completion and moves to top", () => {
    const active = baseTask({ id: "active", order: 0 });
    const done = baseTask({
      id: "done",
      status: "done",
      order: 5,
      completedAt: "2026-07-06T00:00:00.000Z",
    });
    const next = tasksReducer(stateWith([active, done]), {
      type: "RESTORE_TASK",
      id: "done",
      updatedAt: "2026-07-07T00:00:00.000Z",
    });
    const restored = next.tasks.find((t) => t.id === "done");
    expect(restored?.status).toBe("active");
    expect(restored?.completedAt).toBeUndefined();
    expect(restored?.order).toBe(-1);
  });

  it("REORDER_ACTIVE reassigns order by the given id sequence", () => {
    const a = baseTask({ id: "a", order: 0 });
    const b = baseTask({ id: "b", order: 1 });
    const c = baseTask({ id: "c", order: 2 });
    const next = tasksReducer(stateWith([a, b, c]), {
      type: "REORDER_ACTIVE",
      orderedIds: ["c", "a", "b"],
    });
    const orderOf = (id: string) =>
      next.tasks.find((t) => t.id === id)?.order;
    expect(orderOf("c")).toBe(0);
    expect(orderOf("a")).toBe(1);
    expect(orderOf("b")).toBe(2);
  });

  it("TOGGLE_SUBTASK flips the subtask done state", () => {
    const task = baseTask({
      subtasks: [{ id: "s1", title: "Step", done: false }],
    });
    const next = tasksReducer(stateWith([task]), {
      type: "TOGGLE_SUBTASK",
      taskId: "t1",
      subtaskId: "s1",
    });
    expect(next.tasks[0].subtasks[0].done).toBe(true);
  });

  it("DELETE_TASK removes the task", () => {
    const next = tasksReducer(stateWith([baseTask()]), {
      type: "DELETE_TASK",
      id: "t1",
    });
    expect(next.tasks).toHaveLength(0);
  });

  it("ADD_CATEGORY appends a category", () => {
    const category: Category = {
      id: "c1",
      name: "Work",
      createdAt: "2026-07-01T00:00:00.000Z",
    };
    const next = tasksReducer(stateWith([]), {
      type: "ADD_CATEGORY",
      category,
    });
    expect(next.categories).toEqual([category]);
  });

  it("SET_ACTIVE_TAB switches the tab", () => {
    const next = tasksReducer(stateWith([]), {
      type: "SET_ACTIVE_TAB",
      tab: "done",
    });
    expect(next.activeTab).toBe("done");
  });
});
