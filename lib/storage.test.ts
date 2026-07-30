import { beforeEach, describe, expect, it } from "vitest";
import type { PersistedState } from "@/types";
import { emptyState, loadState, readState, saveState } from "@/lib/storage";

const STORAGE_KEY = "todo-ai:v1";

function setRaw(value: unknown): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

beforeEach(() => {
  localStorage.clear();
});

describe("loadState", () => {
  it("returns the empty state when nothing is stored", () => {
    expect(loadState()).toEqual(emptyState);
  });

  it("round-trips a legacy v1 task that has no resources field", () => {
    setRaw({
      tasks: [
        {
          id: "t1",
          title: "Learn SQL",
          description: "Cover joins and indexes",
          categoryId: "cat-1",
          deadline: "2026-08-01",
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
          source: "manual",
          subtasks: [{ id: "s1", title: "Read chapter 1", done: true }],
          order: 3,
          edited: false,
        },
      ],
      categories: [
        { id: "cat-1", name: "SQL", createdAt: "2026-01-01T00:00:00.000Z" },
      ],
      activeTab: "active",
    });

    const state = loadState();
    expect(state.tasks).toHaveLength(1);
    const task = state.tasks[0];

    expect(task.id).toBe("t1");
    expect(task.title).toBe("Learn SQL");
    expect(task.description).toBe("Cover joins and indexes");
    expect(task.categoryId).toBe("cat-1");
    expect(task.deadline).toBe("2026-08-01");
    expect(task.status).toBe("active");
    expect(task.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(task.updatedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(task.source).toBe("manual");
    expect(task.subtasks).toEqual([
      { id: "s1", title: "Read chapter 1", done: true },
    ]);
    expect(task.order).toBe(3);
    expect(task.edited).toBe(false);
    expect(task.resources).toEqual([]);
    expect(state.categories).toEqual([
      { id: "cat-1", name: "SQL", createdAt: "2026-01-01T00:00:00.000Z" },
    ]);
  });

  it("backfills order for a task record that predates the order field", () => {
    setRaw({
      tasks: [
        {
          id: "old-1",
          title: "Old task without an order field",
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          source: "manual",
          subtasks: [],
        },
      ],
      categories: [],
      activeTab: "active",
    });

    const state = loadState();
    expect(state.tasks).toHaveLength(1);
    expect(typeof state.tasks[0].order).toBe("number");
    expect(Number.isNaN(state.tasks[0].order)).toBe(false);
  });

  it.each(["done", "library"] as const)(
    "keeps activeTab %s",
    (tab) => {
      setRaw({ tasks: [], categories: [], activeTab: tab });
      expect(loadState().activeTab).toBe(tab);
    },
  );

  it("falls back to active for an unknown activeTab value", () => {
    setRaw({ tasks: [], categories: [], activeTab: "bogus" });
    expect(loadState().activeTab).toBe("active");
  });

  it("filters out malformed resource entries without discarding the task", () => {
    setRaw({
      tasks: [
        {
          id: "t2",
          title: "Task with mixed resources",
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          source: "manual",
          subtasks: [],
          order: 0,
          edited: false,
          resources: [
            {
              id: "r1",
              kind: "book",
              title: "Valid Book",
              note: "",
              read: false,
            },
            { id: "r2", kind: "book", note: "missing a title", read: false },
            {
              id: "r3",
              kind: "podcast",
              title: "Unknown kind",
              note: "",
              read: false,
            },
            "not an object",
          ],
        },
      ],
      categories: [],
      activeTab: "active",
    });

    const state = loadState();
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].resources).toHaveLength(1);
    expect(state.tasks[0].resources[0].title).toBe("Valid Book");
  });

  it("round-trips a resource with read: true", () => {
    setRaw({
      tasks: [
        {
          id: "t3",
          title: "Task with a read resource",
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          source: "manual",
          subtasks: [],
          order: 0,
          edited: false,
          resources: [
            {
              id: "r1",
              kind: "course",
              title: "Finished Course",
              note: "A course note",
              read: true,
            },
          ],
        },
      ],
      categories: [],
      activeTab: "active",
    });

    const state = loadState();
    expect(state.tasks[0].resources).toHaveLength(1);
    expect(state.tasks[0].resources[0].read).toBe(true);
    expect(state.tasks[0].resources[0].title).toBe("Finished Course");
  });
});

describe("readState", () => {
  it("reports readable storage as not unreadable", () => {
    setRaw({ tasks: [], categories: [], activeTab: "done" });
    expect(readState().unreadable).toBe(false);
  });

  it("reports missing storage as not unreadable", () => {
    expect(readState().unreadable).toBe(false);
  });

  it("flags unparseable storage and still yields the empty state", () => {
    localStorage.setItem(STORAGE_KEY, "{broken");
    const result = readState();
    expect(result.unreadable).toBe(true);
    expect(result.state).toEqual(emptyState);
  });

  it("flags storage whose tasks entry is not traversable", () => {
    setRaw({ tasks: [null], categories: [], activeTab: "active" });
    expect(readState().unreadable).toBe(true);
  });

  it("does not erase the unparseable value it read", () => {
    localStorage.setItem(STORAGE_KEY, "{broken");
    readState();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("{broken");
  });
});

describe("saveState", () => {
  it("persists state so it can be reloaded as-is", () => {
    const state: PersistedState = {
      tasks: [],
      categories: [],
      activeTab: "done",
    };
    saveState(state);
    expect(loadState()).toEqual(state);
  });
});
