"use client";

import type { Task } from "@/types";
import { isOverdue } from "@/lib/sort";
import { TaskItem } from "@/components/task-item";

interface TaskListProps {
  tasks: Task[];
  getCategoryName: (categoryId?: string) => string | undefined;
  onOpenDetails: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onComplete: (task: Task) => void;
  onRestore: (task: Task) => void;
}

export function TaskList({
  tasks,
  getCategoryName,
  onOpenDetails,
  onEdit,
  onDelete,
  onComplete,
  onRestore,
}: TaskListProps) {
  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          categoryName={getCategoryName(task.categoryId)}
          overdue={isOverdue(task)}
          onOpenDetails={onOpenDetails}
          onEdit={onEdit}
          onDelete={onDelete}
          onComplete={onComplete}
          onRestore={onRestore}
        />
      ))}
    </div>
  );
}
