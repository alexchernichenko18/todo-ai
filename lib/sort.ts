import type { Task } from "@/types";

export function todayISODate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isOverdue(task: Task, now: Date = new Date()): boolean {
  if (task.status !== "active" || !task.deadline) return false;
  return task.deadline < todayISODate(now);
}

function activeGroupRank(task: Task, now: Date): number {
  if (isOverdue(task, now)) return 0;
  if (task.deadline) return 1;
  return 2;
}

export function sortActive(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function initialActiveOrder(tasks: Task[], now: Date = new Date()): Task[] {
  return [...tasks].sort((a, b) => {
    const rankA = activeGroupRank(a, now);
    const rankB = activeGroupRank(b, now);
    if (rankA !== rankB) return rankA - rankB;

    if (a.deadline && b.deadline && a.deadline !== b.deadline) {
      return a.deadline < b.deadline ? -1 : 1;
    }

    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function sortDone(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aKey = a.completedAt ?? a.updatedAt ?? a.createdAt;
    const bKey = b.completedAt ?? b.updatedAt ?? b.createdAt;
    return bKey.localeCompare(aKey);
  });
}
