"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Wand2 } from "lucide-react";
import type { AiRecommendationDTO, LearningResource } from "@/types";
import { AiError, aiErrorMessage, requestParseIntent } from "@/lib/ai/client";
import { MAX_PROMPT_LENGTH, validatePromptInput } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AiGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResult: (dto: AiRecommendationDTO, resources: LearningResource[]) => void;
}

export function AiGoalDialog({ open, onOpenChange, onResult }: AiGoalDialogProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function generate() {
    const result = validatePromptInput(text);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      const { recommendation, resources } = await requestParseIntent(text);
      onResult(recommendation, resources);
      setText("");
    } catch (err) {
      if (err instanceof AiError && err.code === "off_topic") {
        setError(aiErrorMessage(err));
      } else {
        toast.error(aiErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Plan a learning goal</DialogTitle>
          <DialogDescription>
            Describe what you want to learn. AI will break it into steps and
            suggest reading.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="ai-goal">Your learning goal</Label>
          <Textarea
            id="ai-goal"
            value={text}
            maxLength={MAX_PROMPT_LENGTH}
            placeholder="e.g. Learn React fundamentals over the next month"
            disabled={loading}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(undefined);
            }}
            aria-invalid={Boolean(error)}
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={generate} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Wand2 />}
            {loading ? "Building..." : "Build the plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
