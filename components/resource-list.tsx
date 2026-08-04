"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import {
  BookOpen,
  FileText,
  GraduationCap,
  Lightbulb,
  Trash2,
} from "lucide-react";
import type { LearningResource, ResourceKind } from "@/types";
import { ResourceTakeawaysDialog } from "@/components/resource-takeaways-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const KIND_LABELS: Record<ResourceKind, string> = {
  book: "Book",
  course: "Course",
  article: "Article",
};

const KIND_ICONS: Record<ResourceKind, typeof BookOpen> = {
  book: BookOpen,
  course: GraduationCap,
  article: FileText,
};

interface ResourceListProps {
  resources: LearningResource[];
  selectedIds?: Set<string>;
  savedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleRead?: (id: string) => void;
  onRemove?: (id: string) => void;
  renderSource?: (id: string) => ReactNode;
}

export function ResourceList({
  resources,
  selectedIds,
  savedIds,
  onToggleSelect,
  onToggleRead,
  onRemove,
  renderSource,
}: ResourceListProps) {
  const [openTakeaways, setOpenTakeaways] = useState<LearningResource | null>(
    null,
  );

  if (resources.length === 0) return null;

  return (
    <>
      <div className="space-y-2">
        {resources.map((resource) => {
          const Icon = KIND_ICONS[resource.kind];
          const saved = savedIds?.has(resource.id) ?? false;
          const meta = [resource.author, resource.year]
            .filter(Boolean)
            .join(" · ");

          return (
            <div
              key={resource.id}
              className={
                "flex items-start gap-2 rounded-lg border p-2.5 text-sm" +
                (saved ? " opacity-60" : "")
              }
            >
              {onToggleSelect ? (
                <Checkbox
                  className="mt-0.5"
                  checked={selectedIds?.has(resource.id) ?? false}
                  disabled={saved}
                  onCheckedChange={() => onToggleSelect(resource.id)}
                  aria-label={`Include "${resource.title}"`}
                />
              ) : onToggleRead ? (
                <Checkbox
                  className="mt-0.5"
                  checked={resource.read}
                  onCheckedChange={() => onToggleRead(resource.id)}
                  aria-label={`Mark "${resource.title}" as read`}
                />
              ) : (
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {resource.url ? (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium break-words underline underline-offset-2"
                    >
                      {resource.title}
                    </a>
                  ) : (
                    <span className="font-medium break-words">
                      {resource.title}
                    </span>
                  )}
                  <Badge variant="secondary" className="gap-1">
                    <Icon className="size-3" />
                    {KIND_LABELS[resource.kind]}
                  </Badge>
                  {saved ? <Badge variant="outline">Saved</Badge> : null}
                </div>

                {meta ? (
                  <p className="text-xs text-muted-foreground">{meta}</p>
                ) : null}

                {resource.note ? (
                  <p className="text-xs text-muted-foreground break-words">
                    {resource.note}
                  </p>
                ) : null}

                {renderSource ? renderSource(resource.id) : null}
              </div>

              {resource.takeaways ? (
                <Tooltip>
                  <TooltipTrigger
                    delay={200}
                    render={
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => setOpenTakeaways(resource)}
                        aria-label={`Key takeaways for "${resource.title}"`}
                      />
                    }
                  >
                    <Lightbulb />
                  </TooltipTrigger>
                  <TooltipContent>Key takeaways</TooltipContent>
                </Tooltip>
              ) : null}

              {onRemove ? (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => onRemove(resource.id)}
                  aria-label={`Remove "${resource.title}"`}
                >
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>

      <ResourceTakeawaysDialog
        resource={openTakeaways}
        onClose={() => setOpenTakeaways(null)}
      />
    </>
  );
}
