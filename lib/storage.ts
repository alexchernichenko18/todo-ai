import type { ActiveTab, PersistedState } from "@/types";

const STORAGE_KEY = "todo-ai:v1";

export const emptyState: PersistedState = {
  tasks: [],
  categories: [],
  activeTab: "active",
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadState(): PersistedState {
  if (!isBrowser()) return emptyState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      activeTab: parsed.activeTab === "done" ? "done" : "active",
    };
  } catch {
    return emptyState;
  }
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
