"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { Category, Subtask, Task } from "@/types";
import { useTasks } from "@/hooks/use-tasks";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  validateTitle,
} from "@/lib/validation";
import type { TaskInput } from "@/components/tasks-provider";
import { CategorySelect } from "@/components/category-select";
import { SubtaskEditor } from "@/components/subtask-editor";
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
  subtasks?: Subtask[];
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

function resolveCategory(
  task: Task | undefined,
  prefill: TaskFormPrefill | undefined,
  categories: Category[],
): { categoryId?: string; initialCreateName?: string } {
  if (task) return { categoryId: task.categoryId };
  if (prefill?.categoryId) return { categoryId: prefill.categoryId };
  const suggested = prefill?.suggestedCategoryName?.trim();
  if (suggested) {
    const match = categories.find(
      (c) => c.name.toLowerCase() === suggested.toLowerCase(),
    );
    return match
      ? { categoryId: match.id }
      : { initialCreateName: suggested };
  }
  return {};
}

function TaskFormBody({
  mode,
  task,
  prefill,
  aiReason,
  onSubmit,
  onOpenChange,
  onBack,
}: Omit<TaskFormDialogProps, "open">) {
  const { categories, addCategory } = useTasks();

  const [title, setTitle] = useState(() =>
    task ? task.title : prefill?.title ?? "",
  );
  const [description, setDescription] = useState(() =>
    task ? task.description ?? "" : prefill?.description ?? "",
  );
  const [deadline, setDeadline] = useState(() =>
    task ? task.deadline ?? "" : prefill?.deadline ?? "",
  );
  const [resolved] = useState(() =>
    resolveCategory(task, prefill, categories),
  );
  const [categoryId, setCategoryId] = useState<string | undefined>(
    resolved.categoryId,
  );
  const [subtasks, setSubtasks] = useState<Subtask[]>(() =>
    task ? task.subtasks : prefill?.subtasks ?? [],
  );
  const [error, setError] = useState<string | undefined>(undefined);

  function handleSubmit() {
    const result = validateTitle(title);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    const cleanedSubtasks = subtasks
      .map((s) => ({ ...s, title: s.title.trim() }))
      .filter((s) => s.title.length > 0);
    onSubmit({ title, description, categoryId, deadline, subtasks: cleanedSubtasks });
    onOpenChange(false);
  }

  return (
    <>
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
            initialCreateName={resolved.initialCreateName}
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

        <div className="space-y-1.5">
          <Label>Subtasks</Label>
          <SubtaskEditor value={subtasks} onChange={setSubtasks} />
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
    </>
  );
}

export function TaskFormDialog({ open, onOpenChange, ...rest }: TaskFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        {open ? (
          <TaskFormBody onOpenChange={onOpenChange} {...rest} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
