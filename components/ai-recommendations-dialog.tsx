"use client";

import { Pencil, X, CalendarClock } from "lucide-react";
import type { AiRecommendationDTO } from "@/types";
import { formatDeadline } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AiRecommendationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recommendations: AiRecommendationDTO[];
  onSelect: (rec: AiRecommendationDTO) => void;
  onReject: (index: number) => void;
}

export function AiRecommendationsDialog({
  open,
  onOpenChange,
  recommendations,
  onSelect,
  onReject,
}: AiRecommendationsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>AI recommendations</DialogTitle>
          <DialogDescription>
            Suggestions based on your task history. Review, edit, or dismiss each
            one.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 max-h-[60vh] space-y-3 overflow-y-auto px-1">
          {recommendations.map((rec, index) => {
            const deadlineLabel = formatDeadline(rec.deadline ?? undefined);
            return (
              <div
                key={`${rec.title}-${index}`}
                className="space-y-2 rounded-xl border p-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium break-words">{rec.title}</p>
                  {rec.description ? (
                    <p className="text-sm text-muted-foreground break-words">
                      {rec.description}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {rec.category ? (
                    <Badge variant="secondary">{rec.category}</Badge>
                  ) : null}
                  {deadlineLabel ? (
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3" />
                      {deadlineLabel}
                    </span>
                  ) : null}
                </div>

                {rec.reason ? (
                  <p className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                    {rec.reason}
                  </p>
                ) : null}

                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onReject(index)}
                  >
                    <X />
                    Dismiss
                  </Button>
                  <Button size="sm" onClick={() => onSelect(rec)}>
                    <Pencil />
                    View & edit
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
