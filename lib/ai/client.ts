import type {
  AiRecommendationDTO,
  LearningResource,
  RecommendationsRequestBody,
} from "@/types";
import { isRecommendationDTO, isRecommendationList } from "@/lib/ai/validate";
import { sanitizeResources, toLearningResources } from "@/lib/ai/resources";

export type AiErrorCode = "network" | "invalid" | "off_topic";

export class AiError extends Error {
  code: AiErrorCode;
  constructor(code: AiErrorCode) {
    super(code);
    this.name = "AiError";
    this.code = code;
  }
}

export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  network: "Couldn't get a response from AI. Please try again.",
  invalid: "AI returned invalid data. Please try again.",
  off_topic:
    'This planner is for learning goals. Try something like "Learn SQL basics" or "Prepare for the IELTS exam".',
};

export function aiErrorMessage(error: unknown): string {
  if (error instanceof AiError) return AI_ERROR_MESSAGES[error.code];
  return AI_ERROR_MESSAGES.network;
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AiError("network");
  }
  if (!response.ok) {
    if (response.status === 422) throw new AiError("off_topic");
    throw new AiError(response.status === 502 ? "invalid" : "network");
  }
  try {
    return await response.json();
  } catch {
    throw new AiError("invalid");
  }
}

export async function requestRecommendations(
  body: RecommendationsRequestBody,
): Promise<{
  recommendations: AiRecommendationDTO[];
  resources: LearningResource[];
}> {
  const data = (await postJson("/api/ai/recommendations", body)) as {
    recommendations?: unknown;
    resources?: unknown;
  };
  if (!isRecommendationList(data.recommendations)) {
    throw new AiError("invalid");
  }
  return {
    recommendations: data.recommendations,
    resources: toLearningResources(sanitizeResources(data.resources)),
  };
}

export async function requestParseIntent(text: string): Promise<{
  recommendation: AiRecommendationDTO;
  resources: LearningResource[];
}> {
  const data = (await postJson("/api/ai/parse-intent", { text })) as {
    recommendation?: unknown;
    resources?: unknown;
  };
  if (!isRecommendationDTO(data.recommendation, "prompt_based")) {
    throw new AiError("invalid");
  }
  return {
    recommendation: data.recommendation,
    resources: toLearningResources(sanitizeResources(data.resources)),
  };
}
