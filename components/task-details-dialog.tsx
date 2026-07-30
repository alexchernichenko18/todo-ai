"use client";

import { Pencil, RotateCcw, Check, Trash2, Sparkles } from "lucide-react";
import type { Task, TaskSource } from "@/types";
import { formatDateTime, formatDeadline } from "@/lib/format";
import { AiBadge } from "@/components/task-item";
import { ResourceList } from "@/components/resource-list";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

const SOURCE_LABELS: Record<TaskSource, string> = {
  manual: "Added manually",
  ai_recommendation: "From AI recommendation",
  ai_prompt: "From a learning goal",
};

interface TaskDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task;
  categoryName?: string;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onToggleStatus: (task: Task) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onToggleResourceRead: (taskId: string, resourceId: string) => void;
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="col-span-2 break-words">{value}</span>
    </div>
  );
}

export function TaskDetailsDialog({
  open,
  onOpenChange,
  task,
  categoryName,
  onEdit,
  onDelete,
  onToggleStatus,
  onToggleSubtask,
  onToggleResourceRead,
}: TaskDetailsDialogProps) {
  if (!task) return null;

  const isActive = task.status === "active";
  const doneSubtasks = task.subtasks.filter((s) => s.done).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6 break-words">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {task.source !== "manual" ? (
            <div>
              <AiBadge task={task} />
            </div>
          ) : null}

          {task.description ? (
            <p className="text-sm whitespace-pre-wrap">{task.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No description.</p>
          )}

          <Separator />

          <div className="space-y-2">
            <Field label="Status" value={isActive ? "Active" : "Done"} />
            <Field label="Subject" value={categoryName} />
            <Field label="Target date" value={formatDeadline(task.deadline)} />
            <Field label="Created" value={formatDateTime(task.createdAt)} />
            <Field label="Updated" value={formatDateTime(task.updatedAt)} />
            <Field label="Completed" value={formatDateTime(task.completedAt)} />
            <Field label="Source" value={SOURCE_LABELS[task.source]} />
          </div>

          {task.subtasks.length > 0 ? (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Study steps</p>
                  <span className="text-xs text-muted-foreground">
                    {doneSubtasks}/{task.subtasks.length}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {task.subtasks.map((sub) => (
                    <label
                      key={sub.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={sub.done}
                        onCheckedChange={() => onToggleSubtask(task.id, sub.id)}
                      />
                      <span
                        className={
                          sub.done
                            ? "text-muted-foreground line-through"
                            : undefined
                        }
                      >
                        {sub.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {task.resources.length > 0 ? (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Reading list</p>
                  <span className="text-xs text-muted-foreground">
                    {task.resources.filter((r) => r.read).length}/
                    {task.resources.length} read
                  </span>
                </div>
                <ResourceList
                  resources={task.resources}
                  onToggleRead={(resourceId) =>
                    onToggleResourceRead(task.id, resourceId)
                  }
                />
              </div>
            </>
          ) : null}

          {task.aiReason ? (
            <div className="flex gap-2 rounded-lg border bg-muted/50 p-3 text-sm">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="space-y-0.5">
                <p className="font-medium">AI explanation</p>
                <p className="text-muted-foreground">{task.aiReason}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          <Button
            variant="outline"
            onClick={() => {
              onToggleStatus(task);
              onOpenChange(false);
            }}
          >
            {isActive ? <Check /> : <RotateCcw />}
            {isActive ? "Complete" : "Restore"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onEdit(task);
            }}
          >
            <Pencil />
            Edit
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onOpenChange(false);
              onDelete(task);
            }}
          >
            <Trash2 />
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
