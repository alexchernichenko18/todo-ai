"use client";

import { Pencil, RotateCcw, Check, Trash2, Sparkles } from "lucide-react";
import type { Task, TaskSource } from "@/types";
import { formatDateTime, formatDeadline } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

const SOURCE_LABELS: Record<TaskSource, string> = {
  manual: "Created manually",
  ai_recommendation: "From AI recommendation",
  ai_prompt: "From text prompt",
};

interface TaskDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task;
  categoryName?: string;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onToggleStatus: (task: Task) => void;
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
}: TaskDetailsDialogProps) {
  if (!task) return null;

  const isActive = task.status === "active";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6 break-words">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {task.description ? (
            <p className="text-sm whitespace-pre-wrap">{task.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No description.</p>
          )}

          <Separator />

          <div className="space-y-2">
            <Field label="Status" value={isActive ? "Active" : "Done"} />
            <Field label="Category" value={categoryName} />
            <Field label="Deadline" value={formatDeadline(task.deadline)} />
            <Field label="Created" value={formatDateTime(task.createdAt)} />
            <Field label="Updated" value={formatDateTime(task.updatedAt)} />
            <Field label="Completed" value={formatDateTime(task.completedAt)} />
            <Field label="Source" value={SOURCE_LABELS[task.source]} />
          </div>

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
