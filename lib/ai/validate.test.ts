import { describe, expect, it } from "vitest";
import type { AiRecommendationDTO } from "@/types";
import { isRecommendationDTO, isRecommendationList } from "@/lib/ai/validate";

function dto(overrides: Partial<AiRecommendationDTO> = {}): AiRecommendationDTO {
  return {
    title: "Learn testing",
    description: "Study unit testing",
    category: "Learning",
    deadline: "2026-08-01",
    reason: "Builds on your history",
    type: "history_based",
    ...overrides,
  };
}

describe("isRecommendationDTO", () => {
  it("accepts a valid DTO", () => {
    expect(isRecommendationDTO(dto())).toBe(true);
  });

  it("accepts a null category and null deadline", () => {
    expect(isRecommendationDTO(dto({ category: null, deadline: null }))).toBe(
      true,
    );
  });

  it("rejects a missing or empty title", () => {
    expect(isRecommendationDTO(dto({ title: "" }))).toBe(false);
  });

  it("rejects a malformed deadline", () => {
    expect(isRecommendationDTO(dto({ deadline: "01/08/2026" }))).toBe(false);
  });

  it("rejects an unknown type", () => {
    expect(
      isRecommendationDTO({ ...dto(), type: "something" as never }),
    ).toBe(false);
  });

  it("enforces the expected type when provided", () => {
    expect(isRecommendationDTO(dto({ type: "history_based" }), "prompt_based")).toBe(
      false,
    );
    expect(isRecommendationDTO(dto({ type: "prompt_based" }), "prompt_based")).toBe(
      true,
    );
  });
});

describe("isRecommendationList", () => {
  it("accepts a non-empty list of history_based items", () => {
    expect(isRecommendationList([dto(), dto()])).toBe(true);
  });

  it("rejects an empty list", () => {
    expect(isRecommendationList([])).toBe(false);
  });

  it("rejects a list containing a prompt_based item", () => {
    expect(isRecommendationList([dto(), dto({ type: "prompt_based" })])).toBe(
      false,
    );
  });
});
