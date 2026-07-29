import { describe, expect, it } from "vitest";
import { guessCategory, parseIntent } from "@/lib/ai/mock";

describe("parseIntent off-topic detection", () => {
  it.each([
    "Buy bread and milk",
    "Call the plumber, already overdue",
    "vacuum the flat and take out the bins",
  ])("treats %s as off-topic", (text) => {
    expect(parseIntent(text).offTopic).toBe(true);
  });

  it.each([
    "Learn SQL basics over the next month",
    "Improve my Spanish",
    "Prepare for a full stack interview next month",
  ])("treats %s as a learning goal", (text) => {
    expect(parseIntent(text).offTopic).toBe(false);
  });
});

describe("guessCategory", () => {
  it("does not misroute 'Build a Next.js app' to Design", () => {
    expect(guessCategory("Build a Next.js app")).not.toBe("Design");
  });
});
