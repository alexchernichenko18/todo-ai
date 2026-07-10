"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, ListTodo, CheckCircle2 } from "lucide-react";
import type { ActiveTab, AiRecommendationDTO, Task, TaskSource } from "@/types";
import { useTasks } from "@/hooks/use-tasks";
import type { TaskInput } from "@/components/tasks-provider";
import {
  TaskFormDialog,
  type TaskFormPrefill,
} from "@/components/task-form-dialog";
import { TaskDetailsDialog } from "@/components/task-details-dialog";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { TaskList } from "@/components/task-list";
import { EmptyState } from "@/components/empty-state";
import { AiPanel } from "@/components/ai-panel";
import { AiRecommendationsDialog } from "@/components/ai-recommendations-dialog";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

type FormConfig =
  | { mode: "create" }
  | { mode: "edit"; task: Task }
  | {
      mode: "proposed";
      prefill: TaskFormPrefill;
      aiReason?: string;
      source: TaskSource;
      onBack?: () => void;
    };

function dtoToPrefill(dto: AiRecommendationDTO): TaskFormPrefill {
  return {
    title: dto.title,
    description: dto.description,
    deadline: dto.deadline ?? undefined,
    suggestedCategoryName: dto.category ?? undefined,
  };
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
  } = useTasks();

  const [formConfig, setFormConfig] = useState<FormConfig | null>(null);
  const [detailsTask, setDetailsTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [recommendations, setRecommendations] = useState<
    AiRecommendationDTO[] | null
  >(null);

  function openCreate() {
    setFormConfig({ mode: "create" });
  }

  function openEdit(task: Task) {
    setFormConfig({ mode: "edit", task });
  }

  function handlePromptResult(dto: AiRecommendationDTO) {
    setFormConfig({
      mode: "proposed",
      prefill: dtoToPrefill(dto),
      aiReason: dto.reason,
      source: "ai_prompt",
    });
  }

  function selectRecommendation(rec: AiRecommendationDTO) {
    const remaining = recommendations;
    setRecommendations(null);
    setFormConfig({
      mode: "proposed",
      prefill: dtoToPrefill(rec),
      aiReason: rec.reason,
      source: "ai_recommendation",
      onBack: () => {
        setFormConfig(null);
        setRecommendations(remaining);
      },
    });
  }

  function rejectRecommendation(index: number) {
    setRecommendations((prev) => {
      if (!prev) return prev;
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : null;
    });
  }

  function handleFormSubmit(input: TaskInput) {
    if (!formConfig) return;
    if (formConfig.mode === "edit") {
      updateTask(formConfig.task.id, input);
      toast.success("Task updated");
      return;
    }
    if (formConfig.mode === "proposed") {
      addTask(input, {
        source: formConfig.source,
        aiReason: formConfig.aiReason,
      });
      toast.success("Task added from AI");
      return;
    }
    addTask(input);
    toast.success("Task created");
  }

  function handleComplete(task: Task) {
    completeTask(task.id);
    toast.success("Task completed");
  }

  function handleRestore(task: Task) {
    restoreTask(task.id);
    toast.success("Task restored");
  }

  function confirmDelete() {
    if (!taskToDelete) return;
    deleteTask(taskToDelete.id);
    toast.success("Task deleted");
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

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Manage your tasks and get structured AI suggestions.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          Add Task
        </Button>
      </header>

      <AiPanel
        onRecommendations={setRecommendations}
        onPromptResult={handlePromptResult}
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as ActiveTab)}
      >
        <TabsList className="w-full">
          <TabsTrigger value="active">Active ({activeTasks.length})</TabsTrigger>
          <TabsTrigger value="done">Done ({doneTasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {activeTasks.length === 0 ? (
            <EmptyState
              icon={<ListTodo className="size-8" />}
              title="You have no active tasks yet."
              description="Create a task manually or describe your goal so AI can help shape it."
              action={
                hasNoTasks ? (
                  <Button onClick={openCreate}>
                    <Plus />
                    Create your first task
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <TaskList
              tasks={activeTasks}
              getCategoryName={getCategoryName}
              onOpenDetails={setDetailsTask}
              onEdit={openEdit}
              onDelete={setTaskToDelete}
              onComplete={handleComplete}
              onRestore={handleRestore}
            />
          )}
        </TabsContent>

        <TabsContent value="done" className="mt-4">
          {doneTasks.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="size-8" />}
              title="Tasks you complete will appear here."
            />
          ) : (
            <TaskList
              tasks={doneTasks}
              getCategoryName={getCategoryName}
              onOpenDetails={setDetailsTask}
              onEdit={openEdit}
              onDelete={setTaskToDelete}
              onComplete={handleComplete}
              onRestore={handleRestore}
            />
          )}
        </TabsContent>
      </Tabs>

      <TaskFormDialog
        open={formConfig !== null}
        onOpenChange={(open) => {
          if (!open) setFormConfig(null);
        }}
        mode={formConfig?.mode ?? "create"}
        task={formConfig?.mode === "edit" ? formConfig.task : undefined}
        prefill={
          formConfig?.mode === "proposed" ? formConfig.prefill : undefined
        }
        aiReason={
          formConfig?.mode === "proposed" ? formConfig.aiReason : undefined
        }
        onSubmit={handleFormSubmit}
        onBack={
          formConfig?.mode === "proposed" ? formConfig.onBack : undefined
        }
      />

      <TaskDetailsDialog
        open={detailsTask !== null}
        onOpenChange={(open) => {
          if (!open) setDetailsTask(null);
        }}
        task={detailsTask ?? undefined}
        categoryName={getCategoryName(detailsTask?.categoryId)}
        onEdit={openEdit}
        onDelete={setTaskToDelete}
        onToggleStatus={(task) =>
          task.status === "active" ? handleComplete(task) : handleRestore(task)
        }
      />

      <DeleteConfirmDialog
        open={taskToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setTaskToDelete(null);
        }}
        taskTitle={taskToDelete?.title}
        onConfirm={confirmDelete}
      />

      <AiRecommendationsDialog
        open={recommendations !== null}
        onOpenChange={(open) => {
          if (!open) setRecommendations(null);
        }}
        recommendations={recommendations ?? []}
        onSelect={selectRecommendation}
        onReject={rejectRecommendation}
      />
    </main>
  );
}
