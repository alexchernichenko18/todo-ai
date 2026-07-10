"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { Category } from "@/types";
import { validateCategoryName } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE_VALUE = "__none__";
const CREATE_VALUE = "__create__";

interface CategorySelectProps {
  categories: Category[];
  value?: string;
  onChange: (categoryId: string | undefined) => void;
  onCreateCategory: (name: string) => Category;
  initialCreateName?: string;
}

export function CategorySelect({
  categories,
  value,
  onChange,
  onCreateCategory,
  initialCreateName,
}: CategorySelectProps) {
  const [creating, setCreating] = useState(Boolean(initialCreateName));
  const [draft, setDraft] = useState(initialCreateName ?? "");
  const [error, setError] = useState<string | undefined>(undefined);

  function handleValueChange(next: string | null) {
    if (next === CREATE_VALUE) {
      setCreating(true);
      return;
    }
    if (next === NONE_VALUE || next === null) {
      onChange(undefined);
      return;
    }
    onChange(next);
  }

  function confirmCreate() {
    const result = validateCategoryName(draft);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    const existing = categories.find(
      (c) => c.name.toLowerCase() === draft.trim().toLowerCase(),
    );
    const category = existing ?? onCreateCategory(draft);
    onChange(category.id);
    setDraft("");
    setError(undefined);
    setCreating(false);
  }

  function cancelCreate() {
    setDraft("");
    setError(undefined);
    setCreating(false);
  }

  if (creating) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            value={draft}
            placeholder="New category name"
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(undefined);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmCreate();
              }
            }}
            aria-invalid={Boolean(error)}
          />
          <Button type="button" size="sm" onClick={confirmCreate}>
            Add
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={cancelCreate}
            aria-label="Cancel new category"
          >
            <X />
          </Button>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <Select
      value={value ?? NONE_VALUE}
      onValueChange={(next) => handleValueChange(next as string | null)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="No category">
          {(current) => {
            if (!current || current === NONE_VALUE) return "No category";
            return (
              categories.find((c) => c.id === current)?.name ?? "No category"
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>No category</SelectItem>
        {categories.map((category) => (
          <SelectItem key={category.id} value={category.id}>
            {category.name}
          </SelectItem>
        ))}
        <SelectItem value={CREATE_VALUE}>
          <Plus />
          Create new category
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
