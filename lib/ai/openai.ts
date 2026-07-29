import OpenAI from "openai";
import type {
  AiRecommendationDTO,
  AiResourceDTO,
  RecommendationsRequestBody,
} from "@/types";
import { todayISODate } from "@/lib/sort";
import { isRecommendationDTO } from "@/lib/ai/validate";
import { MAX_RESOURCES, sanitizeResources } from "@/lib/ai/resources";

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
  required: [
    "title",
    "description",
    "category",
    "deadline",
    "reason",
    "subtasks",
  ],
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

const RESOURCE_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "title", "author", "year", "url", "note"],
  properties: {
    kind: { type: "string", enum: ["book", "article", "course"] },
    title: { type: "string" },
    author: { type: ["string", "null"] },
    year: { type: ["integer", "null"] },
    url: {
      type: ["string", "null"],
      description:
        "Absolute https URL of a long-lived, well-known resource, or null when not certain it exists. Always null for books.",
    },
    note: {
      type: "string",
      description: "One sentence on what this resource gives the learner.",
    },
  },
} as const;

const RESOURCES_GUIDANCE = [
  `Also return between 3 and ${MAX_RESOURCES} learning resources for the topic.`,
  "Prefer books: well-known, widely available titles with a real author and publication year.",
  "Courses and articles may follow, but books must come first.",
  "Never invent a URL. Set url to null unless you are certain the exact address exists and is stable. Always set url to null for books.",
  "Each resource needs a note: one sentence on what it gives the learner for this specific topic.",
].join(" ");

const RECOMMENDATIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["recommendations", "resources"],
  properties: {
    recommendations: {
      type: "array",
      items: RECOMMENDATION_ITEM_SCHEMA,
    },
    resources: {
      type: "array",
      items: RESOURCE_ITEM_SCHEMA,
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
): Promise<{
  recommendations: AiRecommendationDTO[];
  resources: AiResourceDTO[];
}> {
  const today = todayISODate();
  const system = [
    "You are a study-planning assistant for a learning platform.",
    `Today's date is ${today}.`,
    "Analyze what the user is currently learning and has already finished, then suggest between 3 and 5 next learning steps.",
    "Every suggestion must be a learning activity: study a topic, practise a skill, read up on something, build a project for practice, or prepare for an exam, interview or certification.",
    "Never suggest errands, chores, shopping or pure work admin. If the user's history contains such entries, ignore them, or reinterpret them through a learning lens only when that is natural.",
    "Suggestions must build on the user's actual history. Do not invent unrelated topics.",
    "For each suggestion set: a short title, a concise description, a category (a short subject label or null), a deadline (YYYY-MM-DD in the future, or null when a deadline is not useful), a reason explaining why it fits what the user is learning, and subtasks.",
    "For subtasks: include 5-10 ordered study steps when the task naturally breaks down, otherwise return an empty array.",
    RESOURCES_GUIDANCE,
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

  const parsed = parseContent<{
    recommendations: RawRecommendation[];
    resources: unknown;
  }>(response.choices[0]?.message.content ?? null);

  const recommendations: AiRecommendationDTO[] = (
    parsed.recommendations ?? []
  ).map((item) => ({ ...item, type: "history_based" }));

  return { recommendations, resources: sanitizeResources(parsed.resources) };
}

const PARSE_INTENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["offTopic", "recommendation", "resources"],
  properties: {
    offTopic: {
      type: "boolean",
      description:
        "True when the goal is not about learning, studying or acquiring a skill.",
    },
    recommendation: RECOMMENDATION_ITEM_SCHEMA,
    resources: { type: "array", items: RESOURCE_ITEM_SCHEMA },
  },
} as const;

export async function parseIntent(text: string): Promise<{
  offTopic: boolean;
  recommendation: AiRecommendationDTO;
  resources: AiResourceDTO[];
}> {
  const today = todayISODate();
  const system = [
    "You turn a user's learning goal into one structured study task.",
    `Today's date is ${today}.`,
    "First decide whether the goal is about learning: studying a topic, acquiring or practising a skill or language, preparing for an exam, interview or certification, reading up on a subject, or building a project for the sake of practice.",
    "If it is not a learning goal (a chore, an errand, a purchase, a work assignment with no learning in it), set offTopic to true and fill the remaining fields with empty strings, nulls and empty arrays.",
    "If it is a learning goal, set offTopic to false and fill everything in.",
    "Set: a short actionable title, a concise description, a category (a short subject label or null), a deadline (YYYY-MM-DD, derived from any timeframe the user mentions, otherwise null), a reason explaining how the task matches the goal, and subtasks.",
    "For subtasks: include 5-10 ordered study steps.",
    RESOURCES_GUIDANCE,
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
        name: "learning_goal_plan",
        strict: true,
        schema: PARSE_INTENT_SCHEMA,
      },
    },
  });

  const raw = parseContent<{
    offTopic: boolean;
    recommendation: RawRecommendation;
    resources: unknown;
  }>(response.choices[0]?.message.content ?? null);

  if (raw.offTopic) {
    return {
      offTopic: true,
      recommendation: {
        title: "",
        description: "",
        category: null,
        deadline: null,
        reason: "",
        subtasks: [],
        type: "prompt_based",
      },
      resources: [],
    };
  }

  const recommendation: AiRecommendationDTO = {
    ...raw.recommendation,
    type: "prompt_based",
  };

  if (!isRecommendationDTO(recommendation, "prompt_based")) {
    throw new Error("invalid_response");
  }

  return {
    offTopic: false,
    recommendation,
    resources: sanitizeResources(raw.resources),
  };
}
