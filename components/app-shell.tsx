"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, ListTodo, CheckCircle2, Sparkles, Wand2 } from "lucide-react";
import type {
  AiRecommendationDTO,
  LearningResource,
  Task,
  TaskSnapshot,
  TaskSource,
} from "@/types";
import { useTasks } from "@/hooks/use-tasks";
import { newId } from "@/lib/id";
import { aiErrorMessage, requestRecommendations } from "@/lib/ai/client";
import type { TaskInput } from "@/components/tasks-provider";
import {
  TaskFormDialog,
  type TaskFormPrefill,
} from "@/components/task-form-dialog";
import { TaskDetailsDialog } from "@/components/task-details-dialog";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { TaskList } from "@/components/task-list";
import { LibraryTab } from "@/components/library-tab";
import { EmptyState } from "@/components/empty-state";
import { AiGoalDialog } from "@/components/ai-goal-dialog";
import {
  AiRecommendationsDialog,
  type RecommendationsStatus,
} from "@/components/ai-recommendations-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const MIN_HISTORY = 3;

type FormConfig =
  | { mode: "create" }
  | { mode: "edit"; task: Task }
  | {
      mode: "proposed";
      prefill: TaskFormPrefill;
      aiReason?: string;
      source: TaskSource;
      resourceIds: string[];
      onBack?: () => void;
    };

function dtoToPrefill(
  dto: AiRecommendationDTO,
  resources: LearningResource[],
): TaskFormPrefill {
  return {
    title: dto.title,
    description: dto.description,
    deadline: dto.deadline ?? undefined,
    suggestedCategoryName: dto.category ?? undefined,
    subtasks: dto.subtasks.map((title) => ({ id: newId(), title, done: false })),
    resources,
  };
}

function toSnapshots(
  tasks: Task[],
  getCategoryName: (id?: string) => string | undefined,
): TaskSnapshot[] {
  return tasks.map((task) => ({
    title: task.title,
    description: task.description,
    category: getCategoryName(task.categoryId),
    deadline: task.deadline,
    completedAt: task.completedAt,
  }));
}

export function AppShell() {
  const {
    ready,
    tasks,
    activeTasks,
    doneTasks,
    activeTab,
    setActiveTab,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    restoreTask,
    getCategoryName,
    reorderActive,
    toggleSubtask,
    toggleResourceRead,
    removeResource,
  } = useTasks();

  const [formConfig, setFormConfig] = useState<FormConfig | null>(null);
  const [detailsTaskId, setDetailsTaskId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const [goalOpen, setGoalOpen] = useState(false);
  const [recsOpen, setRecsOpen] = useState(false);
  const [recStatus, setRecStatus] = useState<RecommendationsStatus>("loading");
  const [recommendations, setRecommendations] = useState<AiRecommendationDTO[]>(
    [],
  );
  const [recResources, setRecResources] = useState<LearningResource[]>([]);
  const [savedResourceIds, setSavedResourceIds] = useState<Set<string>>(
    new Set(),
  );

  const detailsTask = detailsTaskId
    ? tasks.find((t) => t.id === detailsTaskId) ?? null
    : null;

  function openDetails(task: Task) {
    setDetailsTaskId(task.id);
  }

  function openCreate() {
    setFormConfig({ mode: "create" });
  }

  function openEdit(task: Task) {
    setFormConfig({ mode: "edit", task });
  }

  async function fetchRecommendations() {
    setRecStatus("loading");
    try {
      const { recommendations: recs, resources } = await requestRecommendations({
        activeTasks: toSnapshots(activeTasks, getCategoryName),
        completedTasks: toSnapshots(doneTasks, getCategoryName),
      });
      setRecommendations(recs);
      setRecResources(resources);
      setSavedResourceIds(new Set());
      setRecStatus("ready");
    } catch (error) {
      toast.error(aiErrorMessage(error));
      setRecStatus("error");
    }
  }

  function openRecommendations() {
    setRecsOpen(true);
    if (tasks.length < MIN_HISTORY) {
      setRecStatus("insufficient");
      return;
    }
    if (recStatus !== "ready" || recommendations.length === 0) {
      void fetchRecommendations();
    }
  }

  function handlePromptResult(
    dto: AiRecommendationDTO,
    resources: LearningResource[],
  ) {
    setGoalOpen(false);
    setFormConfig({
      mode: "proposed",
      prefill: dtoToPrefill(dto, resources),
      aiReason: dto.reason,
      source: "ai_prompt",
      resourceIds: [],
    });
  }

  function selectRecommendation(
    rec: AiRecommendationDTO,
    resources: LearningResource[],
  ) {
    setRecsOpen(false);
    setFormConfig({
      mode: "proposed",
      prefill: dtoToPrefill(rec, resources),
      aiReason: rec.reason,
      source: "ai_recommendation",
      resourceIds: resources.map((r) => r.id),
      onBack: () => {
        setFormConfig(null);
        setRecsOpen(true);
      },
    });
  }

  function rejectRecommendation(index: number) {
    setRecommendations((prev) => prev.filter((_, i) => i !== index));
  }

  function handleFormSubmit(input: TaskInput) {
    if (!formConfig) return;
    if (formConfig.mode === "edit") {
      updateTask(formConfig.task.id, input);
      toast.success("Study task updated");
      return;
    }
    if (formConfig.mode === "proposed") {
      addTask(input, {
        source: formConfig.source,
        aiReason: formConfig.aiReason,
      });
      const submittedIds = new Set(
        (input.resources ?? []).map((resource) => resource.id),
      );
      const savedIds = formConfig.resourceIds.filter((id) =>
        submittedIds.has(id),
      );
      if (savedIds.length > 0) {
        setSavedResourceIds((prev) => {
          const next = new Set(prev);
          for (const id of savedIds) next.add(id);
          return next;
        });
      }
      toast.success("Study task added from AI");
      return;
    }
    addTask(input);
    toast.success("Study task created");
  }

  function handleComplete(task: Task) {
    completeTask(task.id);
    toast.success("Study task completed");
  }

  function handleRestore(task: Task) {
    restoreTask(task.id);
    toast.success("Study task restored");
  }

  function confirmDelete() {
    if (!taskToDelete) return;
    deleteTask(taskToDelete.id);
    toast.success("Study task deleted");
  }

  if (!ready) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const hasNoTasks = tasks.length === 0;
  const resourceCount = tasks.reduce(
    (total, task) => total + task.resources.length,
    0,
  );

  const listHandlers = {
    getCategoryName,
    onOpenDetails: openDetails,
    onEdit: openEdit,
    onDelete: setTaskToDelete,
    onComplete: handleComplete,
    onRestore: handleRestore,
    onToggleSubtask: toggleSubtask,
  };

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            My learning plan
          </h1>
          <p className="text-sm text-muted-foreground">
            Track what you are studying and let AI suggest next steps and
            reading.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={openCreate}>
            <Plus />
            Add study task
          </Button>
          <Button variant="outline" onClick={openRecommendations}>
            <Sparkles />
            AI recommendations
          </Button>
          <Button variant="outline" onClick={() => setGoalOpen(true)}>
            <Wand2 />
            Plan a goal
          </Button>
        </div>
      </header>

      <div
        role="tablist"
        className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 text-sm font-medium"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "active"}
          onClick={() => setActiveTab("active")}
          className={cn(
            "rounded-md px-3 py-1.5 transition-colors",
            activeTab === "active"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          In progress ({activeTasks.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "done"}
          onClick={() => setActiveTab("done")}
          className={cn(
            "rounded-md px-3 py-1.5 transition-colors",
            activeTab === "done"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Completed ({doneTasks.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "library"}
          onClick={() => setActiveTab("library")}
          className={cn(
            "rounded-md px-3 py-1.5 transition-colors",
            activeTab === "library"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Library ({resourceCount})
        </button>
      </div>

      <div className="min-h-[55vh]">
        {activeTab === "library" ? (
          <LibraryTab
            tasks={tasks}
            onToggleRead={toggleResourceRead}
            onRemove={removeResource}
            onOpenTask={openDetails}
          />
        ) : activeTab === "active" ? (
          activeTasks.length === 0 ? (
            <EmptyState
              icon={<ListTodo className="size-8" />}
              title="Nothing in progress yet."
              description="Add a study task, or describe a learning goal and let AI build the plan."
              action={
                hasNoTasks ? (
                  <Button onClick={openCreate}>
                    <Plus />
                    Add your first study task
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <TaskList
              tasks={activeTasks}
              sortable
              onReorder={reorderActive}
              {...listHandlers}
            />
          )
        ) : doneTasks.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="size-8" />}
            title="Study tasks you finish will appear here."
          />
        ) : (
          <TaskList tasks={doneTasks} {...listHandlers} />
        )}
      </div>

      <TaskFormDialog
        open={formConfig !== null}
        onOpenChange={(open) => {
          if (!open) setFormConfig(null);
        }}
        mode={formConfig?.mode ?? "create"}
        task={formConfig?.mode === "edit" ? formConfig.task : undefined}
        prefill={formConfig?.mode === "proposed" ? formConfig.prefill : undefined}
        aiReason={
          formConfig?.mode === "proposed" ? formConfig.aiReason : undefined
        }
        onSubmit={handleFormSubmit}
        onBack={formConfig?.mode === "proposed" ? formConfig.onBack : undefined}
      />

      <TaskDetailsDialog
        open={detailsTask !== null}
        onOpenChange={(open) => {
          if (!open) setDetailsTaskId(null);
        }}
        task={detailsTask ?? undefined}
        categoryName={getCategoryName(detailsTask?.categoryId)}
        onEdit={openEdit}
        onDelete={setTaskToDelete}
        onToggleStatus={(task) =>
          task.status === "active" ? handleComplete(task) : handleRestore(task)
        }
        onToggleSubtask={toggleSubtask}
        onToggleResourceRead={toggleResourceRead}
      />

      <DeleteConfirmDialog
        open={taskToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setTaskToDelete(null);
        }}
        taskTitle={taskToDelete?.title}
        onConfirm={confirmDelete}
      />

      <AiGoalDialog
        open={goalOpen}
        onOpenChange={setGoalOpen}
        onResult={handlePromptResult}
      />

      <AiRecommendationsDialog
        open={recsOpen}
        onOpenChange={setRecsOpen}
        status={recStatus}
        recommendations={recommendations}
        resources={recResources}
        savedResourceIds={savedResourceIds}
        onSelect={selectRecommendation}
        onReject={rejectRecommendation}
        onRetry={fetchRecommendations}
      />
    </main>
  );
}
