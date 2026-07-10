"use client";

import {
  MoreVertical,
  Pencil,
  Trash2,
  RotateCcw,
  Check,
  Eye,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import type { Task } from "@/types";
import { formatDeadline, formatDateTime } from "@/lib/format";
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
}: TaskItemProps) {
  const isActive = task.status === "active";
  const deadlineLabel = formatDeadline(task.deadline);

  return (
    <div className="flex items-start gap-3 rounded-xl border p-3 ring-1 ring-transparent transition-colors hover:bg-muted/40">
      {isActive ? (
        <Checkbox
          className="mt-0.5"
          checked={false}
          onCheckedChange={() => onComplete(task)}
          aria-label={`Complete "${task.title}"`}
        />
      ) : (
        <span className="mt-0.5 flex size-4 items-center justify-center rounded-[4px] border bg-muted text-muted-foreground">
          <Check className="size-3" />
        </span>
      )}

      <button
        type="button"
        onClick={() => onOpenDetails(task)}
        className="min-w-0 flex-1 text-left"
      >
        <p
          className={
            isActive
              ? "text-sm font-medium break-words"
              : "text-sm font-medium break-words text-muted-foreground line-through"
          }
        >
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {categoryName ? (
            <Badge variant="secondary">{categoryName}</Badge>
          ) : null}
          {isActive && deadlineLabel ? (
            <span className="inline-flex items-center gap-1">
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
          {!isActive && task.completedAt ? (
            <span>Done {formatDateTime(task.completedAt)}</span>
          ) : null}
          {!isActive && deadlineLabel ? (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3" />
              {deadlineLabel}
            </span>
          ) : null}
        </div>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Task actions" />
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
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(task)}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
