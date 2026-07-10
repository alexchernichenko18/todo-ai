"use client";

import { Pencil, X, CalendarClock, ListChecks, RotateCcw } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";

export type RecommendationsStatus =
  | "loading"
  | "insufficient"
  | "error"
  | "ready";

interface AiRecommendationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: RecommendationsStatus;
  recommendations: AiRecommendationDTO[];
  onSelect: (rec: AiRecommendationDTO) => void;
  onReject: (index: number) => void;
  onRetry: () => void;
}

const NOT_ENOUGH_HISTORY_MESSAGE =
  "Add or complete a few tasks so the system can build personalized recommendations.";

function RecommendationCard({
  rec,
  onSelect,
  onReject,
}: {
  rec: AiRecommendationDTO;
  onSelect: () => void;
  onReject: () => void;
}) {
  const deadlineLabel = formatDeadline(rec.deadline ?? undefined);
  return (
    <div className="space-y-2 rounded-xl border p-3">
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
        {rec.subtasks.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            <ListChecks className="size-3" />
            {rec.subtasks.length} subtasks
          </span>
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
        <Button variant="ghost" size="sm" onClick={onReject}>
          <X />
          Dismiss
        </Button>
        <Button size="sm" onClick={onSelect}>
          <Pencil />
          View & edit
        </Button>
      </div>
    </div>
  );
}

export function AiRecommendationsDialog({
  open,
  onOpenChange,
  status,
  recommendations,
  onSelect,
  onReject,
  onRetry,
}: AiRecommendationsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>AI recommendations</DialogTitle>
          <DialogDescription>
            Suggestions based on your task history. Review, edit, or dismiss each
            one.
          </DialogDescription>
        </DialogHeader>

        {status === "loading" ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : null}

        {status === "insufficient" ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {NOT_ENOUGH_HISTORY_MESSAGE}
          </p>
        ) : null}

        {status === "error" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Couldn&apos;t get a response from AI. Please try again.
            </p>
            <Button variant="outline" onClick={onRetry}>
              <RotateCcw />
              Try again
            </Button>
          </div>
        ) : null}

        {status === "ready" ? (
          recommendations.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                No recommendations left.
              </p>
              <Button variant="outline" onClick={onRetry}>
                <RotateCcw />
                Refresh
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec, index) => (
                <RecommendationCard
                  key={`${rec.title}-${index}`}
                  rec={rec}
                  onSelect={() => onSelect(rec)}
                  onReject={() => onReject(index)}
                />
              ))}
            </div>
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
