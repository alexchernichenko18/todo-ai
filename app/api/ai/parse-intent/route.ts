import type { ParseIntentRequestBody } from "@/types";
import { getParsedIntent } from "@/lib/ai/provider";
import { isRecommendationDTO } from "@/lib/ai/validate";
import { validatePromptInput } from "@/lib/validation";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const text = (body as Partial<ParseIntentRequestBody>)?.text;
  if (typeof text !== "string" || !validatePromptInput(text).valid) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  let result;
  try {
    result = await getParsedIntent(text);
  } catch {
    return Response.json({ error: "upstream" }, { status: 503 });
  }

  if (result.offTopic) {
    return Response.json({ error: "off_topic" }, { status: 422 });
  }

  if (!isRecommendationDTO(result.recommendation, "prompt_based")) {
    return Response.json({ error: "invalid_response" }, { status: 502 });
  }

  return Response.json({
    recommendation: result.recommendation,
    resources: result.resources,
  });
}
