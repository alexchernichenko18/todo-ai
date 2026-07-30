import { describe, expect, it } from "vitest";
import type { AiResourceDTO } from "@/types";
import {
  MAX_RESOURCES,
  sanitizeResourceUrl,
  sanitizeResources,
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
