import { describe, expect, it } from "vitest";
import { generateRecommendations, guessCategory, parseIntent } from "@/lib/ai/mock";
import { MAX_TAKEAWAY_POINTS, sanitizeResources } from "@/lib/ai/resources";

describe("parseIntent off-topic detection", () => {
  it.each([
    "Buy bread and milk",
    "Call the plumber, already overdue",
    "vacuum the flat and take out the bins",
    "Prepare dinner for the guests tonight",
    "Buy a new laptop for programming",
    "Read the news every morning",
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
    expect(guessCategory("Build a Next.js app")).toBeNull();
  });
});

describe("mock resource takeaways", () => {
  it("gives every recommended resource takeaways that survive sanitization", () => {
    const { resources } = generateRecommendations({
      activeTasks: [{ title: "Learn TypeScript generics", category: "Programming" }],
      completedTasks: [{ title: "Learn JavaScript basics", category: "Programming" }],
    });

    expect(resources.length).toBeGreaterThan(0);
    for (const resource of sanitizeResources(resources)) {
      expect(resource.takeaways).not.toBeNull();
      expect(resource.takeaways!.points.length).toBeGreaterThanOrEqual(2);
      expect(resource.takeaways!.fit.length).toBeGreaterThan(0);
    }
  });

  it("gives every parsed-goal resource takeaways", () => {
    const { resources } = parseIntent("Learn SQL basics over the next month");

    expect(resources.length).toBeGreaterThan(0);
    for (const resource of resources) {
      expect(resource.takeaways).toBeTruthy();
      expect(resource.takeaways!.points.length).toBeGreaterThanOrEqual(2);
      expect(resource.takeaways!.fit.length).toBeGreaterThan(0);
    }
  });

  it("keeps every mock takeaway list within the cap", () => {
    const { resources } = parseIntent("Learn design fundamentals");

    for (const resource of resources) {
      expect(resource.takeaways!.points.length).toBeLessThanOrEqual(MAX_TAKEAWAY_POINTS);
    }
  });
});
