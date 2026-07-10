import type { ActiveTab, Category, PersistedState, Task } from "@/types";

export interface TasksState {
  tasks: Task[];
  categories: Category[];
  activeTab: ActiveTab;
  ready: boolean;
}

export type TaskPatch = Partial<
  Pick<Task, "title" | "description" | "categoryId" | "deadline">
>;

export type TasksAction =
  | { type: "HYDRATE"; payload: PersistedState }
  | { type: "ADD_TASK"; task: Task }
  | { type: "UPDATE_TASK"; id: string; patch: TaskPatch; updatedAt: string }
  | { type: "DELETE_TASK"; id: string }
  | { type: "COMPLETE_TASK"; id: string; completedAt: string; updatedAt: string }
  | { type: "RESTORE_TASK"; id: string; updatedAt: string }
  | { type: "ADD_CATEGORY"; category: Category }
  | { type: "SET_ACTIVE_TAB"; tab: ActiveTab };

export const initialTasksState: TasksState = {
  tasks: [],
  categories: [],
  activeTab: "active",
  ready: false,
};

export function tasksReducer(
  state: TasksState,
  action: TasksAction,
): TasksState {
  switch (action.type) {
    case "HYDRATE":
      return {
        tasks: action.payload.tasks,
        categories: action.payload.categories,
        activeTab: action.payload.activeTab,
        ready: true,
      };

    case "ADD_TASK":
      return { ...state, tasks: [...state.tasks, action.task] };

    case "UPDATE_TASK":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id
            ? { ...task, ...action.patch, updatedAt: action.updatedAt }
            : task,
        ),
      };

    case "DELETE_TASK":
      return {
        ...state,
        tasks: state.tasks.filter((task) => task.id !== action.id),
      };

    case "COMPLETE_TASK":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id
            ? {
                ...task,
                status: "done",
                completedAt: action.completedAt,
                updatedAt: action.updatedAt,
              }
            : task,
        ),
      };

    case "RESTORE_TASK":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id
            ? {
                ...task,
                status: "active",
                completedAt: undefined,
                updatedAt: action.updatedAt,
              }
            : task,
        ),
      };

    case "ADD_CATEGORY":
      return { ...state, categories: [...state.categories, action.category] };

    case "SET_ACTIVE_TAB":
      return { ...state, activeTab: action.tab };

    default:
      return state;
  }
}
