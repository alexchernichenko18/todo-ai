"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import {
  MoreVertical,
  Pencil,
  Trash2,
  RotateCcw,
  Check,
  Eye,
  CalendarClock,
  AlertTriangle,
  Sparkles,
  ListChecks,
  ChevronDown,
} from "lucide-react";
import type { Task } from "@/types";
import { formatDeadline } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TaskItemProps {
  task: Task;
  categoryName?: string;
  overdue?: boolean;
  onOpenDetails: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onComplete: (task: Task) => void;
  onRestore: (task: Task) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  dragHandle?: ReactNode;
  setNodeRef?: (el: HTMLElement | null) => void;
  style?: CSSProperties;
  isDragging?: boolean;
}

export function AiBadge({ task }: { task: Task }) {
  if (task.source === "manual") return null;
  return (
    <Badge variant="outline" className="gap-1">
      <Sparkles className="size-3" />
      {task.edited ? "AI · edited" : "AI"}
    </Badge>
  );
}

export function TaskItem({
  task,
  categoryName,
  overdue,
  onOpenDetails,
  onEdit,
  onDelete,
  onComplete,
  onRestore,
  onToggleSubtask,
  dragHandle,
  setNodeRef,
  style,
  isDragging,
}: TaskItemProps) {
  const [expanded, setExpanded] = useState(true);
  const isActive = task.status === "active";
  const deadlineLabel = formatDeadline(task.deadline);
  const completedLabel = formatDeadline(task.completedAt?.slice(0, 10));
  const hasSubtasks = task.subtasks.length > 0;
  const doneSubtasks = task.subtasks.filter((s) => s.done).length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        "rounded-xl border bg-card p-3 transition-colors hover:bg-muted/40" +
        (isDragging ? " opacity-60 shadow-lg" : "")
      }
    >
      <div className="flex items-start gap-2">
        {dragHandle}

        <span className="flex h-5 items-center">
          {isActive ? (
            <Checkbox
              checked={false}
              onCheckedChange={() => onComplete(task)}
              aria-label={`Complete "${task.title}"`}
            />
          ) : (
            <span className="flex size-4 items-center justify-center rounded-[4px] border bg-muted text-muted-foreground">
              <Check className="size-3" />
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onOpenDetails(task)}
            className="w-full -translate-y-0.5 text-left"
          >
            <span
              className={
                isActive
                  ? "text-sm font-medium leading-5 break-words"
                  : "text-sm font-medium leading-5 break-words text-muted-foreground line-through"
              }
            >
              {task.title}
            </span>
          </button>

          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {categoryName ? (
              <Badge variant="secondary">{categoryName}</Badge>
            ) : null}
            <AiBadge task={task} />
            {hasSubtasks ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted hover:text-foreground"
                aria-expanded={expanded}
                aria-label="Toggle subtasks"
              >
                <ListChecks className="size-3" />
                {doneSubtasks}/{task.subtasks.length}
                <ChevronDown
                  className={
                    "size-3 transition-transform" +
                    (expanded ? " rotate-180" : "")
                  }
                />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-start gap-1">
          <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
            {isActive && deadlineLabel ? (
              <span className="inline-flex h-5 items-center gap-1 whitespace-nowrap">
                <CalendarClock className="size-3" />
                {deadlineLabel}
              </span>
            ) : null}
            {isActive && overdue ? (
              <Badge variant="outline" className="border-2 font-semibold">
                <AlertTriangle className="size-3" />
                Overdue
              </Badge>
            ) : null}
            {!isActive && completedLabel ? (
              <span className="flex h-5 items-center whitespace-nowrap">
                Done {completedLabel}
              </span>
            ) : null}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="-mt-0.5"
                  aria-label="Task actions"
                />
              }
            >
              <MoreVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onOpenDetails(task)}>
                <Eye />
                View
              </DropdownMenuItem>
              {isActive ? (
                <>
                  <DropdownMenuItem onClick={() => onComplete(task)}>
                    <Check />
                    Complete
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(task)}>
                    <Pencil />
                    Edit
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={() => onRestore(task)}>
                  <RotateCcw />
                  Restore
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(task)}
              >
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {hasSubtasks && expanded ? (
        <div className="mt-2 space-y-1.5 border-t pt-2 pl-7">
          {task.subtasks.map((sub) => (
            <label key={sub.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={sub.done}
                onCheckedChange={() => onToggleSubtask(task.id, sub.id)}
                aria-label={sub.title}
              />
              <span
                className={
                  sub.done ? "text-muted-foreground line-through" : undefined
                }
              >
                {sub.title}
              </span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
