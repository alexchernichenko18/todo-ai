import type { AiRecommendationDTO, RecommendationType } from "@/types";

const TYPES = new Set<RecommendationType>(["history_based", "prompt_based"]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isDeadline(value: unknown): value is string | null {
  if (value === null) return true;
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isRecommendationDTO(
  value: unknown,
  expectedType?: RecommendationType,
): value is AiRecommendationDTO {
  if (typeof value !== "object" || value === null) return false;
  const dto = value as Record<string, unknown>;
  if (!isNonEmptyString(dto.title)) return false;
  if (typeof dto.description !== "string") return false;
  if (!(dto.category === null || typeof dto.category === "string")) return false;
  if (!isDeadline(dto.deadline)) return false;
  if (typeof dto.reason !== "string") return false;
  if (
    !Array.isArray(dto.subtasks) ||
    !dto.subtasks.every((s) => typeof s === "string")
  ) {
    return false;
  }
  if (typeof dto.type !== "string" || !TYPES.has(dto.type as RecommendationType)) {
    return false;
  }
  if (expectedType && dto.type !== expectedType) return false;
  return true;
}

export function isRecommendationList(
  value: unknown,
): value is AiRecommendationDTO[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => isRecommendationDTO(item, "history_based"))
  );
}
