"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Wand2, Loader2 } from "lucide-react";
import type { AiRecommendationDTO, Task, TaskSnapshot } from "@/types";
import { useTasks } from "@/hooks/use-tasks";
import {
  aiErrorMessage,
  requestParseIntent,
  requestRecommendations,
} from "@/lib/ai/client";
import { MAX_PROMPT_LENGTH, validatePromptInput } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const MIN_HISTORY = 3;
const NOT_ENOUGH_HISTORY_MESSAGE =
  "Add or complete a few tasks so the system can build personalized recommendations.";

interface AiPanelProps {
  onRecommendations: (recs: AiRecommendationDTO[]) => void;
  onPromptResult: (dto: AiRecommendationDTO) => void;
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

export function AiPanel({ onRecommendations, onPromptResult }: AiPanelProps) {
  const { tasks, activeTasks, doneTasks, getCategoryName } = useTasks();

  const [recLoading, setRecLoading] = useState(false);
  const [historyNote, setHistoryNote] = useState<string | undefined>(undefined);

  const [promptText, setPromptText] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState<string | undefined>(undefined);

  const hasEnoughHistory = tasks.length >= MIN_HISTORY;

  async function handleGetRecommendations() {
    if (!hasEnoughHistory) {
      setHistoryNote(NOT_ENOUGH_HISTORY_MESSAGE);
      return;
    }
    setHistoryNote(undefined);
    setRecLoading(true);
    try {
      const recs = await requestRecommendations({
        activeTasks: toSnapshots(activeTasks, getCategoryName),
        completedTasks: toSnapshots(doneTasks, getCategoryName),
      });
      onRecommendations(recs);
    } catch (error) {
      toast.error(aiErrorMessage(error));
    } finally {
      setRecLoading(false);
    }
  }

  async function handleGenerate() {
    const result = validatePromptInput(promptText);
    if (!result.valid) {
      setPromptError(result.error);
      return;
    }
    setPromptError(undefined);
    setPromptLoading(true);
    try {
      const dto = await requestParseIntent(promptText);
      onPromptResult(dto);
      setPromptText("");
    } catch (error) {
      toast.error(aiErrorMessage(error));
    } finally {
      setPromptLoading(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4" />
          AI assistant
        </CardTitle>
        <CardDescription>
          Get suggestions based on your history, or turn a goal into a task. You
          always decide what to add.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Button
            variant="outline"
            onClick={handleGetRecommendations}
            disabled={recLoading}
          >
            {recLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {recLoading ? "Getting recommendations..." : "Get AI recommendations"}
          </Button>
          {historyNote ? (
            <p className="text-sm text-muted-foreground">{historyNote}</p>
          ) : null}
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="ai-prompt">Describe a goal</Label>
          <Textarea
            id="ai-prompt"
            value={promptText}
            maxLength={MAX_PROMPT_LENGTH}
            placeholder="Describe your goal or what you want to do..."
            disabled={promptLoading}
            onChange={(e) => {
              setPromptText(e.target.value);
              if (promptError) setPromptError(undefined);
            }}
            aria-invalid={Boolean(promptError)}
          />
          {promptError ? (
            <p className="text-xs text-destructive">{promptError}</p>
          ) : null}
          <Button onClick={handleGenerate} disabled={promptLoading}>
            {promptLoading ? <Loader2 className="animate-spin" /> : <Wand2 />}
            {promptLoading ? "Generating..." : "Generate task"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
