"use client";

import type { LearningResource } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ResourceTakeawaysDialogProps {
  resource: LearningResource | null;
  onClose: () => void;
}

export function ResourceTakeawaysDialog({
  resource,
  onClose,
}: ResourceTakeawaysDialogProps) {
  const takeaways = resource?.takeaways;
  const meta = resource
    ? [resource.author, resource.year].filter(Boolean).join(" · ")
    : "";

  return (
    <Dialog
      open={Boolean(takeaways)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6 break-words">
            {resource?.title}
          </DialogTitle>
          {meta ? <DialogDescription>{meta}</DialogDescription> : null}
        </DialogHeader>

        {takeaways ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Key takeaways
              </p>
              <ul className="list-disc space-y-1.5 pl-4">
                {takeaways.points.map((point) => (
                  <li key={point} className="break-words">
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Good fit if
              </p>
              <p className="break-words text-muted-foreground">
                {takeaways.fit}
              </p>
            </div>
          </div>
        ) : null}

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
