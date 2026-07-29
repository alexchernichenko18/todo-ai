import type { ActiveTab, Category, PersistedState, Task } from "@/types";

export interface TasksState {
  tasks: Task[];
  categories: Category[];
  activeTab: ActiveTab;
  ready: boolean;
}

export type TaskPatch = Partial<
  Pick<
    Task,
    "title" | "description" | "categoryId" | "deadline" | "subtasks" | "resources"
  >
>;

export type TasksAction =
  | { type: "HYDRATE"; payload: PersistedState }
  | { type: "ADD_TASK"; task: Task }
  | { type: "UPDATE_TASK"; id: string; patch: TaskPatch; updatedAt: string }
  | { type: "DELETE_TASK"; id: string }
  | { type: "COMPLETE_TASK"; id: string; completedAt: string; updatedAt: string }
  | { type: "RESTORE_TASK"; id: string; updatedAt: string }
  | { type: "REORDER_ACTIVE"; orderedIds: string[] }
  | { type: "TOGGLE_SUBTASK"; taskId: string; subtaskId: string }
  | { type: "TOGGLE_RESOURCE_READ"; taskId: string; resourceId: string }
  | { type: "REMOVE_RESOURCE"; taskId: string; resourceId: string }
  | { type: "ADD_CATEGORY"; category: Category }
  | { type: "SET_ACTIVE_TAB"; tab: ActiveTab };

export const initialTasksState: TasksState = {
  tasks: [],
  categories: [],
  activeTab: "active",
  ready: false,
};

function topActiveOrder(tasks: Task[]): number {
  const orders = tasks
    .filter((t) => t.status === "active")
    .map((t) => t.order);
  return orders.length > 0 ? Math.min(...orders) - 1 : 0;
}

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
      return {
        ...state,
        tasks: [
          ...state.tasks,
          { ...action.task, order: topActiveOrder(state.tasks) },
        ],
      };

    case "UPDATE_TASK":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id
            ? {
                ...task,
                ...action.patch,
                updatedAt: action.updatedAt,
                edited: true,
              }
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

    case "RESTORE_TASK": {
      const order = topActiveOrder(state.tasks);
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id
            ? {
                ...task,
                status: "active",
                completedAt: undefined,
                updatedAt: action.updatedAt,
                order,
              }
            : task,
        ),
      };
    }

    case "REORDER_ACTIVE": {
      const orderMap = new Map(action.orderedIds.map((id, index) => [id, index]));
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          orderMap.has(task.id)
            ? { ...task, order: orderMap.get(task.id) as number }
            : task,
        ),
      };
    }

    case "TOGGLE_SUBTASK":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId
            ? {
                ...task,
                subtasks: task.subtasks.map((sub) =>
                  sub.id === action.subtaskId
                    ? { ...sub, done: !sub.done }
                    : sub,
                ),
              }
            : task,
        ),
      };

    case "TOGGLE_RESOURCE_READ":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId
            ? {
                ...task,
                resources: task.resources.map((resource) =>
                  resource.id === action.resourceId
                    ? { ...resource, read: !resource.read }
                    : resource,
                ),
              }
            : task,
        ),
      };

    case "REMOVE_RESOURCE":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId
            ? {
                ...task,
                resources: task.resources.filter(
                  (resource) => resource.id !== action.resourceId,
                ),
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
