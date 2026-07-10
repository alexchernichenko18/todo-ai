import type {
  AiRecommendationDTO,
  RecommendationsRequestBody,
} from "@/types";
import { isRecommendationDTO, isRecommendationList } from "@/lib/ai/validate";

export type AiErrorCode = "network" | "invalid";

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
): Promise<AiRecommendationDTO[]> {
  const data = (await postJson("/api/ai/recommendations", body)) as {
    recommendations?: unknown;
  };
  if (!isRecommendationList(data.recommendations)) {
    throw new AiError("invalid");
  }
  return data.recommendations;
}

export async function requestParseIntent(
  text: string,
): Promise<AiRecommendationDTO> {
  const data = (await postJson("/api/ai/parse-intent", { text })) as {
    recommendation?: unknown;
  };
  if (!isRecommendationDTO(data.recommendation, "prompt_based")) {
    throw new AiError("invalid");
  }
  return data.recommendation;
}
