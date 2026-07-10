import OpenAI from "openai";
import type {
  AiRecommendationDTO,
  RecommendationsRequestBody,
} from "@/types";
import { todayISODate } from "@/lib/sort";
import { isRecommendationDTO } from "@/lib/ai/validate";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI();
  }
  return client;
}

function getModel(): string {
  return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}

const RECOMMENDATION_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "category", "deadline", "reason", "subtasks"],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    category: { type: ["string", "null"] },
    deadline: {
      type: ["string", "null"],
      description: "Due date as YYYY-MM-DD, or null.",
    },
    reason: { type: "string" },
    subtasks: {
      type: "array",
      items: { type: "string" },
      description:
        "5-10 ordered step titles if the task naturally breaks down, otherwise an empty array.",
    },
  },
} as const;

const RECOMMENDATIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["recommendations"],
  properties: {
    recommendations: {
      type: "array",
      items: RECOMMENDATION_ITEM_SCHEMA,
    },
  },
} as const;

interface RawRecommendation {
  title: string;
  description: string;
  category: string | null;
  deadline: string | null;
  reason: string;
  subtasks: string[];
}

function parseContent<T>(content: string | null): T {
  if (!content) {
    throw new Error("empty_response");
  }
  return JSON.parse(content) as T;
}

export async function generateRecommendations(
  body: RecommendationsRequestBody,
): Promise<AiRecommendationDTO[]> {
  const today = todayISODate();
  const system = [
    "You are a personal task-planning assistant.",
    `Today's date is ${today}.`,
    "Analyze the user's active and completed tasks and suggest between 3 and 5 new tasks that are a logical next step for them.",
    "Suggestions must build on the user's actual history. Do not invent unrelated tasks.",
    "For each suggestion set: a short title, a concise description, a category (a short label or null), a deadline (YYYY-MM-DD in the future, or null when a deadline is not useful), a reason explaining why it fits the user's history, and subtasks.",
    "For subtasks: include 5-10 ordered step titles when the task naturally breaks down into steps, otherwise return an empty array.",
    "Respond only with data matching the provided JSON schema.",
  ].join(" ");

  const response = await getClient().chat.completions.create({
    model: getModel(),
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: JSON.stringify({
          activeTasks: body.activeTasks,
          completedTasks: body.completedTasks,
        }),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "task_recommendations",
        strict: true,
        schema: RECOMMENDATIONS_SCHEMA,
      },
    },
  });

  const parsed = parseContent<{ recommendations: RawRecommendation[] }>(
    response.choices[0]?.message.content ?? null,
  );

  const recommendations: AiRecommendationDTO[] = (
    parsed.recommendations ?? []
  ).map((item) => ({ ...item, type: "history_based" }));

  return recommendations;
}

export async function parseIntent(text: string): Promise<AiRecommendationDTO> {
  const today = todayISODate();
  const system = [
    "You convert a user's free-text goal into exactly one structured task.",
    `Today's date is ${today}.`,
    "Set: a short actionable title, a concise description, a category (a short label or null), a deadline (YYYY-MM-DD, derived from any timeframe the user mentions, otherwise null), a reason explaining how the task matches the described intent, and subtasks.",
    "For subtasks: include 5-10 ordered step titles when the goal naturally breaks down into steps (for example learning or preparing for something), otherwise return an empty array.",
    "Respond only with data matching the provided JSON schema.",
  ].join(" ");

  const response = await getClient().chat.completions.create({
    model: getModel(),
    messages: [
      { role: "system", content: system },
      { role: "user", content: text },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "task_from_intent",
        strict: true,
        schema: RECOMMENDATION_ITEM_SCHEMA,
      },
    },
  });

  const raw = parseContent<RawRecommendation>(
    response.choices[0]?.message.content ?? null,
  );

  const recommendation: AiRecommendationDTO = {
    ...raw,
    type: "prompt_based",
  };

  if (!isRecommendationDTO(recommendation, "prompt_based")) {
    throw new Error("invalid_response");
  }

  return recommendation;
}
