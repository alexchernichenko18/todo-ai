import type {
  RecommendationsRequestBody,
  TaskSnapshot,
} from "@/types";
import { getRecommendations } from "@/lib/ai/provider";
import { isRecommendationList } from "@/lib/ai/validate";

function isSnapshotArray(value: unknown): value is TaskSnapshot[] {
  return Array.isArray(value) && value.every((item) => {
    return (
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).title === "string"
    );
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const data = body as Partial<RecommendationsRequestBody>;
  if (!isSnapshotArray(data.activeTasks) || !isSnapshotArray(data.completedTasks)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  let recommendations;
  try {
    recommendations = await getRecommendations({
      activeTasks: data.activeTasks,
      completedTasks: data.completedTasks,
    });
  } catch {
    return Response.json({ error: "upstream" }, { status: 503 });
  }

  if (!isRecommendationList(recommendations)) {
    return Response.json({ error: "invalid_response" }, { status: 502 });
  }

  return Response.json({ recommendations });
}
