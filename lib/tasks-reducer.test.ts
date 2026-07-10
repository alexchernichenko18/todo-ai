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

  it("ADD_TASK appends a task", () => {
    const next = tasksReducer(stateWith([]), {
      type: "ADD_TASK",
      task: baseTask({ id: "new" }),
    });
    expect(next.tasks.map((t) => t.id)).toEqual(["new"]);
  });

  it("UPDATE_TASK applies the patch and updates the timestamp", () => {
    const next = tasksReducer(stateWith([baseTask()]), {
      type: "UPDATE_TASK",
      id: "t1",
      patch: { title: "Renamed", deadline: "2026-08-01" },
      updatedAt: "2026-07-05T00:00:00.000Z",
    });
    expect(next.tasks[0].title).toBe("Renamed");
    expect(next.tasks[0].deadline).toBe("2026-08-01");
    expect(next.tasks[0].updatedAt).toBe("2026-07-05T00:00:00.000Z");
  });

  it("COMPLETE_TASK marks the task done and stamps completion", () => {
    const next = tasksReducer(stateWith([baseTask()]), {
      type: "COMPLETE_TASK",
      id: "t1",
      completedAt: "2026-07-06T00:00:00.000Z",
      updatedAt: "2026-07-06T00:00:00.000Z",
    });
    expect(next.tasks[0].status).toBe("done");
    expect(next.tasks[0].completedAt).toBe("2026-07-06T00:00:00.000Z");
  });

  it("RESTORE_TASK reactivates the task and clears completion", () => {
    const done = baseTask({
      status: "done",
      completedAt: "2026-07-06T00:00:00.000Z",
    });
    const next = tasksReducer(stateWith([done]), {
      type: "RESTORE_TASK",
      id: "t1",
      updatedAt: "2026-07-07T00:00:00.000Z",
    });
    expect(next.tasks[0].status).toBe("active");
    expect(next.tasks[0].completedAt).toBeUndefined();
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
