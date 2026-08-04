import { describe, expect, it } from "vitest";
import type { AiResourceDTO } from "@/types";
import {
  MAX_RESOURCES,
  MAX_TAKEAWAY_POINTS,
  sanitizeResourceUrl,
  sanitizeResources,
  sanitizeTakeaways,
  toLearningResources,
} from "@/lib/ai/resources";

function dto(overrides: Partial<AiResourceDTO> = {}): AiResourceDTO {
  return {
    kind: "course",
    title: "Course",
    author: null,
    year: null,
    url: null,
    note: "Useful.",
    takeaways: null,
    ...overrides,
  };
}

describe("sanitizeResourceUrl", () => {
  it("always strips the url from a book", () => {
    expect(
      sanitizeResourceUrl("https://www.oreilly.com/library/x", "book"),
    ).toBeUndefined();
  });

  it("keeps an allowlisted host", () => {
    expect(sanitizeResourceUrl("https://coursera.org/learn/x", "course")).toBe(
      "https://coursera.org/learn/x",
    );
  });

  it("keeps a subdomain of an allowlisted host", () => {
    expect(
      sanitizeResourceUrl("https://www.coursera.org/learn/x", "course"),
    ).toBe("https://www.coursera.org/learn/x");
  });

  it("rejects a lookalike host that only ends with the allowed name", () => {
    expect(
      sanitizeResourceUrl("https://coursera.org.evil.com/learn/x", "course"),
    ).toBeUndefined();
  });

  it("rejects a host that merely contains an allowed name", () => {
    expect(
      sanitizeResourceUrl("https://notcoursera.org/learn/x", "course"),
    ).toBeUndefined();
  });

  it("rejects plain http", () => {
    expect(
      sanitizeResourceUrl("http://coursera.org/learn/x", "course"),
    ).toBeUndefined();
  });

  it("rejects unparseable input without throwing", () => {
    expect(sanitizeResourceUrl("not a url", "article")).toBeUndefined();
    expect(sanitizeResourceUrl(null, "article")).toBeUndefined();
    expect(sanitizeResourceUrl(42, "article")).toBeUndefined();
  });

  it("strips userinfo from an otherwise-allowlisted host", () => {
    expect(
      sanitizeResourceUrl("https://google.com@coursera.org/x", "course"),
    ).toBe("https://coursera.org/x");
  });

  it("rejects a trailing-dot FQDN even though it resolves to the same host", () => {
    expect(
      sanitizeResourceUrl("https://coursera.org./x", "course"),
    ).toBeUndefined();
  });
});

describe("sanitizeResources", () => {
  it("returns an empty array for non-array input", () => {
    expect(sanitizeResources(null)).toEqual([]);
    expect(sanitizeResources("text")).toEqual([]);
    expect(sanitizeResources({})).toEqual([]);
  });

  it("keeps a resource whose url was rejected", () => {
    const [result] = sanitizeResources([
      dto({ title: "Some Course", url: "https://made-up-site.example/x" }),
    ]);
    expect(result.title).toBe("Some Course");
    expect(result.url).toBeNull();
  });

  it("drops resources without a title", () => {
    expect(sanitizeResources([dto({ title: "   " }), dto({ title: "Ok" })])).toHaveLength(1);
  });

  it("drops resources with an unknown kind", () => {
    expect(sanitizeResources([{ ...dto(), kind: "podcast" }])).toEqual([]);
  });

  it("deduplicates by case-insensitive title", () => {
    const result = sanitizeResources([
      dto({ title: "Clean Code" }),
      dto({ title: "clean code" }),
    ]);
    expect(result).toHaveLength(1);
  });

  it("orders books, then courses, then articles", () => {
    const result = sanitizeResources([
      dto({ kind: "article", title: "A" }),
      dto({ kind: "book", title: "B" }),
      dto({ kind: "course", title: "C" }),
    ]);
    expect(result.map((r) => r.kind)).toEqual(["book", "course", "article"]);
  });

  it("caps the list at MAX_RESOURCES", () => {
    const many = Array.from({ length: 8 }, (_, i) => dto({ title: `T${i}` }));
    expect(sanitizeResources(many)).toHaveLength(MAX_RESOURCES);
  });

  it("rejects an out-of-range or non-numeric year", () => {
    expect(sanitizeResources([dto({ title: "A", year: 1800 })])[0].year).toBeNull();
    expect(sanitizeResources([dto({ title: "B", year: 3200 })])[0].year).toBeNull();
    expect(
      sanitizeResources([{ ...dto(), title: "C", year: "1999" }])[0].year,
    ).toBeNull();
  });

  it("keeps a plausible year", () => {
    expect(sanitizeResources([dto({ title: "A", year: 1999 })])[0].year).toBe(1999);
  });

  it("normalizes a missing note to an empty string", () => {
    expect(
      sanitizeResources([{ ...dto(), title: "A", note: undefined }])[0].note,
    ).toBe("");
  });
});

describe("toLearningResources", () => {
  it("assigns unique ids and read: false", () => {
    const result = toLearningResources([dto({ title: "A" }), dto({ title: "B" })]);
    expect(result[0].id).not.toBe(result[1].id);
    expect(result.every((r) => r.read === false)).toBe(true);
  });

  it("converts nulls to undefined", () => {
    const [result] = toLearningResources([
      dto({ title: "A", author: null, year: null, url: null }),
    ]);
    expect(result.author).toBeUndefined();
    expect(result.year).toBeUndefined();
    expect(result.url).toBeUndefined();
  });
});

describe("sanitizeTakeaways", () => {
  it("keeps valid points and fit", () => {
    expect(
      sanitizeTakeaways({
        points: ["Naming carries the readability weight", "Functions do one thing"],
        fit: "Good for developers shipping production code.",
      }),
    ).toEqual({
      points: ["Naming carries the readability weight", "Functions do one thing"],
      fit: "Good for developers shipping production code.",
    });
  });

  it("trims points and drops the empty ones", () => {
    expect(
      sanitizeTakeaways({
        points: ["  Spaced repetition works  ", "", "   ", "Testing beats rereading"],
        fit: "Useful for anyone studying.",
      }),
    ).toEqual({
      points: ["Spaced repetition works", "Testing beats rereading"],
      fit: "Useful for anyone studying.",
    });
  });

  it("returns null when fewer than two points survive", () => {
    expect(
      sanitizeTakeaways({ points: ["Only one", "  "], fit: "Anyone." }),
    ).toBeNull();
  });

  it("returns null when fit is empty", () => {
    expect(
      sanitizeTakeaways({ points: ["First point", "Second point"], fit: "   " }),
    ).toBeNull();
  });

  it("caps the points at MAX_TAKEAWAY_POINTS", () => {
    const result = sanitizeTakeaways({
      points: ["a", "b", "c", "d", "e", "f", "g", "h"],
      fit: "Anyone.",
    });
    expect(result?.points).toHaveLength(MAX_TAKEAWAY_POINTS);
    expect(result?.points[0]).toBe("a");
  });

  it("returns null when the points repeat a single idea", () => {
    expect(
      sanitizeTakeaways({ points: ["Same point", "Same point"], fit: "Anyone." }),
    ).toBeNull();
  });

  it("treats points that differ only by surrounding whitespace as one", () => {
    expect(
      sanitizeTakeaways({ points: ["Same point", "  Same point  "], fit: "Anyone." }),
    ).toBeNull();
  });

  it("drops duplicate points but keeps the distinct ones in order", () => {
    expect(
      sanitizeTakeaways({
        points: ["Spacing beats cramming", "Spacing beats cramming", "Retrieval beats rereading"],
        fit: "Useful for anyone studying.",
      }),
    ).toEqual({
      points: ["Spacing beats cramming", "Retrieval beats rereading"],
      fit: "Useful for anyone studying.",
    });
  });

  it("caps the deduplicated points at MAX_TAKEAWAY_POINTS", () => {
    const result = sanitizeTakeaways({
      points: ["a", "a", "b", "c", "d", "e", "f", "g"],
      fit: "Anyone.",
    });
    expect(result?.points).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("returns null for a non-object", () => {
    expect(sanitizeTakeaways(null)).toBeNull();
    expect(sanitizeTakeaways("takeaways")).toBeNull();
  });

  it("returns null when points is not an array", () => {
    expect(sanitizeTakeaways({ points: "First. Second.", fit: "Anyone." })).toBeNull();
  });
});

describe("sanitizeResources with takeaways", () => {
  it("keeps sanitized takeaways on the resource", () => {
    const [resource] = sanitizeResources([
      {
        kind: "book",
        title: "Make It Stick",
        author: "Brown",
        year: 2014,
        url: null,
        note: "What the research says.",
        takeaways: {
          points: ["Retrieval beats rereading", "Spacing beats cramming"],
          fit: "Good for anyone studying seriously.",
        },
      },
    ]);
    expect(resource.takeaways).toEqual({
      points: ["Retrieval beats rereading", "Spacing beats cramming"],
      fit: "Good for anyone studying seriously.",
    });
  });

  it("nulls out takeaways the model returned malformed", () => {
    const [resource] = sanitizeResources([
      {
        kind: "book",
        title: "Some Book",
        author: null,
        year: null,
        url: null,
        note: "A note.",
        takeaways: { points: ["Only one point"], fit: "Anyone." },
      },
    ]);
    expect(resource.takeaways).toBeNull();
  });

  it("nulls out takeaways the model omitted entirely", () => {
    const [resource] = sanitizeResources([
      { kind: "book", title: "Bare Book", author: null, year: null, url: null, note: "A note." },
    ]);
    expect(resource.takeaways).toBeNull();
  });
});

describe("toLearningResources with takeaways", () => {
  it("carries takeaways over to the domain resource", () => {
    const [resource] = toLearningResources([
      dto({
        takeaways: { points: ["First point", "Second point"], fit: "Anyone curious." },
      }),
    ]);
    expect(resource.takeaways).toEqual({
      points: ["First point", "Second point"],
      fit: "Anyone curious.",
    });
  });

  it("turns a null DTO takeaways into undefined", () => {
    const [resource] = toLearningResources([dto({ takeaways: null })]);
    expect(resource.takeaways).toBeUndefined();
  });
});
