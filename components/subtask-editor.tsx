"use client";

import { GripVertical, Plus, X } from "lucide-react";
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
import type { Subtask } from "@/types";
import { newId } from "@/lib/id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SubtaskEditorProps {
  value: Subtask[];
  onChange: (subtasks: Subtask[]) => void;
}

function SubtaskRow({
  subtask,
  onTitleChange,
  onRemove,
}: {
  subtask: Subtask;
  onTitleChange: (title: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: subtask.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        "flex items-center gap-1.5" + (isDragging ? " opacity-60" : "")
      }
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="Drag to reorder subtask"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <Input
        value={subtask.title}
        placeholder="Subtask"
        onChange={(e) => onTitleChange(e.target.value)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        aria-label="Remove subtask"
      >
        <X />
      </Button>
    </div>
  );
}

export function SubtaskEditor({ value, onChange }: SubtaskEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function updateTitle(id: string, title: string) {
    onChange(value.map((s) => (s.id === id ? { ...s, title } : s)));
  }

  function remove(id: string) {
    onChange(value.filter((s) => s.id !== id));
  }

  function add() {
    onChange([...value, { id: newId(), title: "", done: false }]);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = value.map((s) => s.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(value, oldIndex, newIndex));
  }

  return (
    <div className="space-y-2">
      {value.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={value.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1.5">
              {value.map((subtask) => (
                <SubtaskRow
                  key={subtask.id}
                  subtask={subtask}
                  onTitleChange={(title) => updateTitle(subtask.id, title)}
                  onRemove={() => remove(subtask.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : null}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus />
        Add subtask
      </Button>
    </div>
  );
}
