import type {
  ActiveTab,
  LearningResource,
  PersistedState,
  ResourceKind,
  Subtask,
  Task,
} from "@/types";
import { initialActiveOrder } from "@/lib/sort";
import { sanitizeTakeaways } from "@/lib/ai/resources";

const STORAGE_KEY = "todo-ai:v1";

export interface LoadResult {
  state: PersistedState;
  unreadable: boolean;
}

export const emptyState: PersistedState = {
  tasks: [],
  categories: [],
  activeTab: "active",
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function normalizeSubtasks(value: unknown): Subtask[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s) => s && typeof s.title === "string")
    .map((s) => ({
      id: typeof s.id === "string" ? s.id : String(s.title),
      title: s.title,
      done: Boolean(s.done),
    }));
}

const RESOURCE_KINDS = new Set<ResourceKind>(["book", "article", "course"]);

function normalizeResources(value: unknown): LearningResource[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (r) =>
        r &&
        typeof r.title === "string" &&
        r.title.trim().length > 0 &&
        RESOURCE_KINDS.has(r.kind),
    )
    .map((r) => ({
      id: typeof r.id === "string" ? r.id : String(r.title),
      kind: r.kind as ResourceKind,
      title: r.title,
      author: typeof r.author === "string" ? r.author : undefined,
      year: typeof r.year === "number" ? r.year : undefined,
      url: typeof r.url === "string" ? r.url : undefined,
      note: typeof r.note === "string" ? r.note : "",
      takeaways: sanitizeTakeaways(r.takeaways) ?? undefined,
      read: Boolean(r.read),
    }));
}

function normalizeTasks(rawTasks: unknown): Task[] {
  const list = Array.isArray(rawTasks) ? (rawTasks as Task[]) : [];
  const needsOrder = list.some((t) => typeof t.order !== "number");

  const normalized = list.map((t) => ({
    ...t,
    subtasks: normalizeSubtasks(t.subtasks),
    resources: normalizeResources(t.resources),
    edited: typeof t.edited === "boolean" ? t.edited : false,
    order: typeof t.order === "number" ? t.order : 0,
  }));

  if (!needsOrder) return normalized;

  const active = normalized.filter((t) => t.status === "active");
  const orderMap = new Map(
    initialActiveOrder(active).map((t, index) => [t.id, index]),
  );
  return normalized.map((t) => ({ ...t, order: orderMap.get(t.id) ?? 0 }));
}

export function readState(): LoadResult {
  if (!isBrowser()) return { state: emptyState, unreadable: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: emptyState, unreadable: false };
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      state: {
        tasks: normalizeTasks(parsed.tasks),
        categories: Array.isArray(parsed.categories) ? parsed.categories : [],
        activeTab:
          parsed.activeTab === "done" || parsed.activeTab === "library"
            ? parsed.activeTab
            : "active",
      },
      unreadable: false,
    };
  } catch {
    return { state: emptyState, unreadable: true };
  }
}

export function loadState(): PersistedState {
  return readState().state;
}

export function saveState(state: PersistedState): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    return;
  }
}

export type { ActiveTab };
