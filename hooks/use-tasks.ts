"use client";

import { useContext } from "react";
import { TasksContext, type TasksContextValue } from "@/components/tasks-provider";

export function useTasks(): TasksContextValue {
  const ctx = useContext(TasksContext);
  if (!ctx) {
    throw new Error("useTasks must be used within a TasksProvider");
  }
  return ctx;
}
