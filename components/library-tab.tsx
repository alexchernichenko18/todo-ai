"use client";

import { Library } from "lucide-react";
import type { LearningResource, ResourceKind, Task } from "@/types";
import { ResourceList } from "@/components/resource-list";
import { EmptyState } from "@/components/empty-state";

const GROUPS: Array<{ kind: ResourceKind; label: string }> = [
  { kind: "book", label: "Books" },
  { kind: "course", label: "Courses" },
  { kind: "article", label: "Articles" },
];

interface LibraryEntry {
  resource: LearningResource;
  task: Task;
}

interface LibraryTabProps {
  tasks: Task[];
  onToggleRead: (taskId: string, resourceId: string) => void;
  onRemove: (taskId: string, resourceId: string) => void;
  onOpenTask: (task: Task) => void;
}

export function LibraryTab({
  tasks,
  onToggleRead,
  onRemove,
  onOpenTask,
}: LibraryTabProps) {
  const entries: LibraryEntry[] = tasks.flatMap((task) =>
    task.resources.map((resource) => ({ resource, task })),
  );

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Library className="size-8" />}
        title="Your reading list is empty."
        description="Reading that AI suggests for your study goals will collect here."
      />
    );
  }

  const taskByResourceId = new Map(
    entries.map((entry) => [entry.resource.id, entry.task]),
  );

  return (
    <div className="space-y-6">
      {GROUPS.map(({ kind, label }) => {
        const group = entries.filter((entry) => entry.resource.kind === kind);
        if (group.length === 0) return null;
        const readCount = group.filter((entry) => entry.resource.read).length;

        return (
          <div key={kind} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{label}</p>
              <span className="text-xs text-muted-foreground">
                {readCount}/{group.length} read
              </span>
            </div>
            <ResourceList
              resources={group.map((entry) => entry.resource)}
              onToggleRead={(resourceId) => {
                const task = taskByResourceId.get(resourceId);
                if (task) onToggleRead(task.id, resourceId);
              }}
              onRemove={(resourceId) => {
                const task = taskByResourceId.get(resourceId);
                if (task) onRemove(task.id, resourceId);
              }}
              renderSource={(resourceId) => {
                const task = taskByResourceId.get(resourceId);
                if (!task) return null;
                return (
                  <button
                    type="button"
                    onClick={() => onOpenTask(task)}
                    className="text-xs text-muted-foreground underline underline-offset-2"
                  >
                    From: {task.title}
                  </button>
                );
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
