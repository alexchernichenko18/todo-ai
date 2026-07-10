"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { Task } from "@/types";
import { useTasks } from "@/hooks/use-tasks";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  validateTitle,
} from "@/lib/validation";
import type { TaskInput } from "@/components/tasks-provider";
import { CategorySelect } from "@/components/category-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type TaskFormMode = "create" | "edit" | "proposed";

export interface TaskFormPrefill {
  title?: string;
  description?: string;
  deadline?: string;
  categoryId?: string;
  suggestedCategoryName?: string;
}

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: TaskFormMode;
  task?: Task;
  prefill?: TaskFormPrefill;
  aiReason?: string;
  onSubmit: (input: TaskInput) => void;
  onBack?: () => void;
}

const TITLES: Record<TaskFormMode, string> = {
  create: "New task",
  edit: "Edit task",
  proposed: "Proposed task",
};

const SUBMIT_LABELS: Record<TaskFormMode, string> = {
  create: "Create task",
  edit: "Save changes",
  proposed: "Add to tasks",
};

export function TaskFormDialog({
  open,
  onOpenChange,
  mode,
  task,
  prefill,
  aiReason,
  onSubmit,
  onBack,
}: TaskFormDialogProps) {
  const { categories, addCategory } = useTasks();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [initialCreateName, setInitialCreateName] = useState<
    string | undefined
  >(undefined);

  useEffect(() => {
    if (!open) return;
    const base = task
      ? {
          title: task.title,
          description: task.description ?? "",
          categoryId: task.categoryId,
          deadline: task.deadline ?? "",
        }
      : {
          title: prefill?.title ?? "",
          description: prefill?.description ?? "",
          categoryId: prefill?.categoryId,
          deadline: prefill?.deadline ?? "",
        };

    setTitle(base.title);
    setDescription(base.description);
    setDeadline(base.deadline);
    setError(undefined);

    const suggested = prefill?.suggestedCategoryName?.trim();
    if (!base.categoryId && suggested) {
      const match = categories.find(
        (c) => c.name.toLowerCase() === suggested.toLowerCase(),
      );
      setCategoryId(match?.id);
      setInitialCreateName(match ? undefined : suggested);
    } else {
      setCategoryId(base.categoryId);
      setInitialCreateName(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleSubmit() {
    const result = validateTitle(title);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    onSubmit({
      title,
      description,
      categoryId,
      deadline,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{TITLES[mode]}</DialogTitle>
          <DialogDescription>
            {mode === "proposed"
              ? "Review and edit the details, then add it to your tasks."
              : "Fill in the details for your task."}
          </DialogDescription>
        </DialogHeader>

        {mode === "proposed" && aiReason ? (
          <div className="flex gap-2 rounded-lg border bg-muted/50 p-3 text-sm">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="space-y-0.5">
              <p className="font-medium">Why AI suggested this</p>
              <p className="text-muted-foreground">{aiReason}</p>
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              placeholder="What needs to be done?"
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError(undefined);
              }}
              aria-invalid={Boolean(error)}
            />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={description}
              maxLength={MAX_DESCRIPTION_LENGTH}
              placeholder="Add more detail (optional)"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <CategorySelect
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
              onCreateCategory={addCategory}
              initialCreateName={initialCreateName}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-deadline">Deadline</Label>
            <Input
              id="task-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          {mode === "proposed" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => (onBack ? onBack() : onOpenChange(false))}
            >
              Back
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          )}
          <Button type="button" onClick={handleSubmit}>
            {SUBMIT_LABELS[mode]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
