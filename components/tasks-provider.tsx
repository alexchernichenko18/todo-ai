"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type {
  ActiveTab,
  Category,
  LearningResource,
  Subtask,
  Task,
  TaskSource,
} from "@/types";
import { newId } from "@/lib/id";
import { loadState, saveState } from "@/lib/storage";
import { sortActive, sortDone } from "@/lib/sort";
import {
  initialTasksState,
  tasksReducer,
  type TaskPatch,
} from "@/lib/tasks-reducer";

export interface TaskInput {
  title: string;
  description?: string;
  categoryId?: string;
  deadline?: string;
  subtasks?: Subtask[];
  resources?: LearningResource[];
}

export interface AddTaskOptions {
  source?: TaskSource;
  aiReason?: string;
}

export interface TasksContextValue {
  ready: boolean;
  tasks: Task[];
  categories: Category[];
  activeTasks: Task[];
  doneTasks: Task[];
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  addTask: (input: TaskInput, options?: AddTaskOptions) => Task;
  updateTask: (id: string, input: TaskInput) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string) => void;
  restoreTask: (id: string) => void;
  addCategory: (name: string) => Category;
  getCategoryName: (categoryId?: string) => string | undefined;
  reorderActive: (orderedIds: string[]) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  toggleResourceRead: (taskId: string, resourceId: string) => void;
  removeResource: (taskId: string, resourceId: string) => void;
}

export const TasksContext = createContext<TasksContextValue | null>(null);

function cleanText(value?: string): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toPatch(input: TaskInput): TaskPatch {
  return {
    title: input.title.trim(),
    description: cleanText(input.description),
    categoryId: cleanText(input.categoryId),
    deadline: cleanText(input.deadline),
    subtasks: input.subtasks ?? [],
    resources: input.resources ?? [],
  };
}

export function TasksProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tasksReducer, initialTasksState);

  useEffect(() => {
    dispatch({ type: "HYDRATE", payload: loadState() });
  }, []);

  useEffect(() => {
    if (!state.ready) return;
    saveState({
      tasks: state.tasks,
      categories: state.categories,
      activeTab: state.activeTab,
    });
  }, [state.ready, state.tasks, state.categories, state.activeTab]);

  const setActiveTab = useCallback((tab: ActiveTab) => {
    dispatch({ type: "SET_ACTIVE_TAB", tab });
  }, []);

  const addTask = useCallback(
    (input: TaskInput, options?: AddTaskOptions): Task => {
      const now = new Date().toISOString();
      const patch = toPatch(input);
      const task: Task = {
        id: newId(),
        title: patch.title ?? "",
        description: patch.description,
        categoryId: patch.categoryId,
        deadline: patch.deadline,
        status: "active",
        createdAt: now,
        updatedAt: now,
        source: options?.source ?? "manual",
        aiReason: options?.aiReason,
        subtasks: input.subtasks ?? [],
        resources: input.resources ?? [],
        order: 0,
        edited: false,
      };
      dispatch({ type: "ADD_TASK", task });
      return task;
    },
    [],
  );

  const updateTask = useCallback((id: string, input: TaskInput) => {
    dispatch({
      type: "UPDATE_TASK",
      id,
      patch: toPatch(input),
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const deleteTask = useCallback((id: string) => {
    dispatch({ type: "DELETE_TASK", id });
  }, []);

  const completeTask = useCallback((id: string) => {
    const now = new Date().toISOString();
    dispatch({ type: "COMPLETE_TASK", id, completedAt: now, updatedAt: now });
  }, []);

  const restoreTask = useCallback((id: string) => {
    dispatch({
      type: "RESTORE_TASK",
      id,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const addCategory = useCallback((name: string): Category => {
    const category: Category = {
      id: newId(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: "ADD_CATEGORY", category });
    return category;
  }, []);

  const reorderActive = useCallback((orderedIds: string[]) => {
    dispatch({ type: "REORDER_ACTIVE", orderedIds });
  }, []);

  const toggleSubtask = useCallback((taskId: string, subtaskId: string) => {
    dispatch({ type: "TOGGLE_SUBTASK", taskId, subtaskId });
  }, []);

  const toggleResourceRead = useCallback(
    (taskId: string, resourceId: string) => {
      dispatch({ type: "TOGGLE_RESOURCE_READ", taskId, resourceId });
    },
    [],
  );

  const removeResource = useCallback((taskId: string, resourceId: string) => {
    dispatch({ type: "REMOVE_RESOURCE", taskId, resourceId });
  }, []);

  const activeTasks = useMemo(
    () => sortActive(state.tasks.filter((t) => t.status === "active")),
    [state.tasks],
  );

  const doneTasks = useMemo(
    () => sortDone(state.tasks.filter((t) => t.status === "done")),
    [state.tasks],
  );

  const getCategoryName = useCallback(
    (categoryId?: string) =>
      categoryId
        ? state.categories.find((c) => c.id === categoryId)?.name
        : undefined,
    [state.categories],
  );

  const value = useMemo<TasksContextValue>(
    () => ({
      ready: state.ready,
      tasks: state.tasks,
      categories: state.categories,
      activeTasks,
      doneTasks,
      activeTab: state.activeTab,
      setActiveTab,
      addTask,
      updateTask,
      deleteTask,
      completeTask,
      restoreTask,
      addCategory,
      getCategoryName,
      reorderActive,
      toggleSubtask,
      toggleResourceRead,
      removeResource,
    }),
    [
      state.ready,
      state.tasks,
      state.categories,
      state.activeTab,
      activeTasks,
      doneTasks,
      setActiveTab,
      addTask,
      updateTask,
      deleteTask,
      completeTask,
      restoreTask,
      addCategory,
      getCategoryName,
      reorderActive,
      toggleSubtask,
      toggleResourceRead,
      removeResource,
    ],
  );

  return (
    <TasksContext.Provider value={value}>{children}</TasksContext.Provider>
  );
}
