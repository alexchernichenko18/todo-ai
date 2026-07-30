import type {
  AiRecommendationDTO,
  AiResourceDTO,
  RecommendationsRequestBody,
} from "@/types";
import { generateRecommendations as mockRecs, parseIntent as mockParse } from "@/lib/ai/mock";
import {
  generateRecommendations as openaiRecs,
  parseIntent as openaiParse,
} from "@/lib/ai/openai";

const MOCK_DELAY_MS = 800;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function getRecommendations(
  body: RecommendationsRequestBody,
): Promise<{
  recommendations: AiRecommendationDTO[];
  resources: AiResourceDTO[];
}> {
  if (hasOpenAIKey()) {
    return openaiRecs(body);
  }
  await delay(MOCK_DELAY_MS);
  return mockRecs(body);
}

export async function getParsedIntent(text: string): Promise<{
  offTopic: boolean;
  recommendation: AiRecommendationDTO;
  resources: AiResourceDTO[];
}> {
  if (hasOpenAIKey()) {
    return openaiParse(text);
  }
  await delay(MOCK_DELAY_MS);
  return mockParse(text);
}
