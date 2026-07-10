import { describe, expect, it } from "vitest";
import {
  MAX_TITLE_LENGTH,
  normalizeTitle,
  validateCategoryName,
  validatePromptInput,
  validateTitle,
} from "@/lib/validation";

describe("validateTitle", () => {
  it("rejects an empty or whitespace-only title", () => {
    expect(validateTitle("").valid).toBe(false);
    expect(validateTitle("   ").valid).toBe(false);
  });

  it("rejects a title over the max length", () => {
    expect(validateTitle("a".repeat(MAX_TITLE_LENGTH + 1)).valid).toBe(false);
  });

  it("accepts a normal title", () => {
    expect(validateTitle("Buy milk").valid).toBe(true);
  });
});

describe("normalizeTitle", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeTitle("  hello  ")).toBe("hello");
  });
});

describe("validatePromptInput", () => {
  it("rejects empty and whitespace-only input", () => {
    expect(validatePromptInput("").valid).toBe(false);
    expect(validatePromptInput("     ").valid).toBe(false);
  });

  it("rejects input that is too short", () => {
    expect(validatePromptInput("hi").valid).toBe(false);
  });

  it("accepts input with enough context", () => {
    expect(validatePromptInput("Prepare for my interview").valid).toBe(true);
  });
});

describe("validateCategoryName", () => {
  it("rejects empty names", () => {
    expect(validateCategoryName("  ").valid).toBe(false);
  });

  it("accepts a normal name", () => {
    expect(validateCategoryName("Work").valid).toBe(true);
  });
});
