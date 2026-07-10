"use client";

import { GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "@/types";
import { isOverdue } from "@/lib/sort";
import { TaskItem } from "@/components/task-item";

interface TaskListHandlers {
  getCategoryName: (categoryId?: string) => string | undefined;
  onOpenDetails: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onComplete: (task: Task) => void;
  onRestore: (task: Task) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
}

interface TaskListProps extends TaskListHandlers {
  tasks: Task[];
  sortable?: boolean;
  onReorder?: (orderedIds: string[]) => void;
}

function Row({ task, ...handlers }: { task: Task } & TaskListHandlers) {
  return (
    <TaskItem
      task={task}
      categoryName={handlers.getCategoryName(task.categoryId)}
      overdue={isOverdue(task)}
      onOpenDetails={handlers.onOpenDetails}
      onEdit={handlers.onEdit}
      onDelete={handlers.onDelete}
      onComplete={handlers.onComplete}
      onRestore={handlers.onRestore}
      onToggleSubtask={handlers.onToggleSubtask}
    />
  );
}

function SortableRow({ task, ...handlers }: { task: Task } & TaskListHandlers) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handle = (
    <button
      type="button"
      className="flex h-5 cursor-grab touch-none items-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
      aria-label="Drag to reorder"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-4" />
    </button>
  );

  return (
    <TaskItem
      task={task}
      categoryName={handlers.getCategoryName(task.categoryId)}
      overdue={isOverdue(task)}
      onOpenDetails={handlers.onOpenDetails}
      onEdit={handlers.onEdit}
      onDelete={handlers.onDelete}
      onComplete={handlers.onComplete}
      onRestore={handlers.onRestore}
      onToggleSubtask={handlers.onToggleSubtask}
      dragHandle={handle}
      setNodeRef={setNodeRef}
      style={style}
      isDragging={isDragging}
    />
  );
}

export function TaskList({
  tasks,
  sortable,
  onReorder,
  ...handlers
}: TaskListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  if (!sortable) {
    return (
      <div className="space-y-2">
        {tasks.map((task) => (
          <Row key={task.id} task={task} {...handlers} />
        ))}
      </div>
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = tasks.map((t) => t.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder?.(arrayMove(ids, oldIndex, newIndex));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {tasks.map((task) => (
            <SortableRow key={task.id} task={task} {...handlers} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
