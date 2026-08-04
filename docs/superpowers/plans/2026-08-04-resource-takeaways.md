# Resource Takeaways Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every AI-suggested learning resource carries a short summary — key takeaways plus one sentence on who it suits — reachable from a tooltipped icon in the reading list that opens a nested modal.

**Architecture:** Takeaways arrive in the same AI call that already returns resources (`/api/ai/recommendations`, `/api/ai/parse-intent`), are sanitized server-side, and persist inside `LearningResource` in `localStorage`. `ResourceList` owns the icon, the tooltip and a single modal instance, so none of its four call sites change. A resource without takeaways simply shows no icon.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Base UI (`@base-ui/react`) for Dialog and Tooltip, Tailwind 4, lucide-react icons, OpenAI SDK with strict `json_schema` responses, Vitest for units, Playwright for e2e.

**Spec:** `docs/superpowers/specs/2026-08-04-resource-takeaways-design.md`

## Global Constraints

- **No code comments.** This codebase contains none; do not add any.
- **All application-facing text in English.** Ukrainian appears only in `PROJECT_SPEC.md` and `docs/`.
- Storage key stays `todo-ai:v1`. No migration, no version bump — `takeaways` is optional.
- `LearningResource.takeaways` is `ResourceTakeaways | undefined`; `AiResourceDTO.takeaways` is `ResourceTakeaways | null`. Match the existing convention (DTO uses `null`, domain uses `undefined`).
- Sanitization rule is all-or-nothing: fewer than 2 surviving points, or an empty `fit`, yields `null`. Never a partial object.
- OpenAI strict mode forbids optional properties — `takeaways` is `required` in the JSON schema even though sanitization may discard it.
- Unit tests run with `npm test` (Vitest, project `unit`). E2E runs with `npm run test:e2e`.
- There are no component tests in this repository and none are being introduced; UI behaviour is verified by Playwright.
- Icon for takeaways is lucide's `Lightbulb`. Do **not** use `Sparkles` — `task-details-dialog.tsx` already imports it for the AI badge.

---

### Task 1: Takeaways type and sanitization

The domain type plus the pure function that turns untrusted input into either a complete `ResourceTakeaways` or `null`. Everything downstream depends on this, so it lands first.

**Files:**
- Modify: `types/index.ts` (after `ResourceKind`, before `LearningResource`)
- Modify: `lib/ai/resources.ts`
- Test: `lib/ai/resources.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks. Existing helpers in `lib/ai/resources.ts`: `sanitizeText(value: unknown): string | null`, `MAX_RESOURCES`, `sanitizeResources(raw: unknown): AiResourceDTO[]`, `toLearningResources(dtos: AiResourceDTO[]): LearningResource[]`.
- Produces:
  - `ResourceTakeaways { points: string[]; fit: string }` exported from `types/index.ts`
  - `LearningResource.takeaways?: ResourceTakeaways`
  - `AiResourceDTO.takeaways: ResourceTakeaways | null`
  - `sanitizeTakeaways(raw: unknown): ResourceTakeaways | null` exported from `lib/ai/resources.ts`
  - `MAX_TAKEAWAY_POINTS = 6` exported from `lib/ai/resources.ts`

- [ ] **Step 1: Add the types**

In `types/index.ts`, insert after the `ResourceKind` type alias:

```ts
export interface ResourceTakeaways {
  points: string[];
  fit: string;
}
```

Add the field to `LearningResource` (after `note`, before `read`):

```ts
  takeaways?: ResourceTakeaways;
```

Add the field to `AiResourceDTO` (after `note`):

```ts
  takeaways: ResourceTakeaways | null;
```

- [ ] **Step 2: Write the failing tests**

In `lib/ai/resources.test.ts`, add `sanitizeTakeaways` to the existing import from `@/lib/ai/resources`, add `takeaways: null` to the `dto()` factory defaults (so existing tests keep compiling), and append these blocks:

```ts
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
```

Also add `MAX_TAKEAWAY_POINTS` to the same import statement.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- lib/ai/resources.test.ts`
Expected: FAIL — `sanitizeTakeaways is not a function`, plus TypeScript errors about the unknown `takeaways` property.

- [ ] **Step 4: Implement the sanitizer**

In `lib/ai/resources.ts`, add the constants next to the existing `MAX_RESOURCES`:

```ts
export const MAX_TAKEAWAY_POINTS = 6;

const MIN_TAKEAWAY_POINTS = 2;
```

Add `ResourceTakeaways` to the type import from `@/types`, then add the function below the existing `sanitizeText`:

```ts
export function sanitizeTakeaways(raw: unknown): ResourceTakeaways | null {
  if (typeof raw !== "object" || raw === null) return null;
  const candidate = raw as Record<string, unknown>;

  if (!Array.isArray(candidate.points)) return null;
  const points = candidate.points
    .map((point) => sanitizeText(point))
    .filter((point): point is string => point !== null)
    .slice(0, MAX_TAKEAWAY_POINTS);
  if (points.length < MIN_TAKEAWAY_POINTS) return null;

  const fit = sanitizeText(candidate.fit);
  if (fit === null) return null;

  return { points, fit };
}
```

In `sanitizeResources`, add one line to the `cleaned.push({ ... })` object, after `note`:

```ts
      takeaways: sanitizeTakeaways(candidate.takeaways),
```

In `toLearningResources`, add one line to the mapped object, after `note`:

```ts
    takeaways: dto.takeaways ?? undefined,
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- lib/ai/resources.test.ts`
Expected: PASS, all describes green.

- [ ] **Step 6: Commit**

```bash
git add types/index.ts lib/ai/resources.ts lib/ai/resources.test.ts
git commit -m "feat: sanitize resource takeaways from AI responses"
```

---

### Task 2: Persist takeaways through storage

`localStorage` content is untrusted input just like an AI response, so it goes through the same sanitizer rather than a second hand-rolled check.

**Files:**
- Modify: `lib/storage.ts` (`normalizeResources`, around lines 40-61)
- Test: `lib/storage.test.ts`

**Interfaces:**
- Consumes: `sanitizeTakeaways(raw: unknown): ResourceTakeaways | null` from Task 1.
- Produces: `normalizeResources` now emits `takeaways?: ResourceTakeaways` on every loaded resource.

- [ ] **Step 1: Write the failing tests**

Append to `lib/storage.test.ts`:

```ts
describe("resource takeaways", () => {
  function storedTaskWithResource(resource: unknown): void {
    setRaw({
      tasks: [
        {
          id: "t1",
          title: "Learn SQL",
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          source: "ai_prompt",
          subtasks: [],
          resources: [resource],
          order: 0,
          edited: false,
        },
      ],
      categories: [],
      activeTab: "active",
    });
  }

  it("round-trips takeaways", () => {
    storedTaskWithResource({
      id: "r1",
      kind: "book",
      title: "Make It Stick",
      note: "What the research says.",
      read: false,
      takeaways: {
        points: ["Retrieval beats rereading", "Spacing beats cramming"],
        fit: "Good for anyone studying seriously.",
      },
    });

    expect(loadState().tasks[0].resources[0].takeaways).toEqual({
      points: ["Retrieval beats rereading", "Spacing beats cramming"],
      fit: "Good for anyone studying seriously.",
    });
  });

  it("loads a resource saved before takeaways existed", () => {
    storedTaskWithResource({
      id: "r1",
      kind: "book",
      title: "The Pragmatic Programmer",
      note: "Day-to-day habits.",
      read: true,
    });

    const resource = loadState().tasks[0].resources[0];
    expect(resource.takeaways).toBeUndefined();
    expect(resource.title).toBe("The Pragmatic Programmer");
  });

  it("drops malformed takeaways instead of failing the load", () => {
    storedTaskWithResource({
      id: "r1",
      kind: "book",
      title: "Broken Book",
      note: "A note.",
      read: false,
      takeaways: { points: "not an array", fit: 42 },
    });

    expect(loadState().tasks[0].resources[0].takeaways).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- lib/storage.test.ts`
Expected: FAIL — the first test reports `takeaways` as `undefined` because `normalizeResources` drops unknown fields.

- [ ] **Step 3: Implement the normalization**

In `lib/storage.ts`, add the import:

```ts
import { sanitizeTakeaways } from "@/lib/ai/resources";
```

In `normalizeResources`, add one line to the mapped object, after `note`:

```ts
      takeaways: sanitizeTakeaways(r.takeaways) ?? undefined,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- lib/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the whole unit suite**

Run: `npm test`
Expected: PASS — no regressions in `tasks-reducer`, `sort`, `validation`, `ai/*`.

- [ ] **Step 6: Commit**

```bash
git add lib/storage.ts lib/storage.test.ts
git commit -m "feat: persist resource takeaways in local storage"
```

---

### Task 3: Generate takeaways in the AI layer

Both the real OpenAI path and the mock path must produce takeaways. The mock matters as much as the real one: without an API key the app falls back to it, and the Playwright suite drives the real UI flow through it.

**Files:**
- Modify: `lib/ai/openai.ts` (`RESOURCE_ITEM_SCHEMA` lines 53-72, `RESOURCES_GUIDANCE` lines 74-80)
- Modify: `lib/ai/mock.ts` (`RESOURCES_BY_CATEGORY` lines 48-70, `GENERIC_RESOURCES` lines 72-76)
- Test: `lib/ai/mock.test.ts`

**Interfaces:**
- Consumes: `sanitizeResources`, `MAX_TAKEAWAY_POINTS` from Task 1; `AiResourceDTO.takeaways: ResourceTakeaways | null`.
- Produces: every `AiResourceDTO` returned by `lib/ai/mock.ts` has non-null `takeaways`. No new exports.

- [ ] **Step 1: Write the failing test**

In `lib/ai/mock.test.ts`, replace the existing import line:

```ts
import { guessCategory, parseIntent } from "@/lib/ai/mock";
```

with:

```ts
import { generateRecommendations, guessCategory, parseIntent } from "@/lib/ai/mock";
import { MAX_TAKEAWAY_POINTS, sanitizeResources } from "@/lib/ai/resources";
```

Then append:

```ts
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
      expect(resource.takeaways).not.toBeNull();
    }
  });

  it("keeps every mock takeaway list within the cap", () => {
    const { resources } = parseIntent("Learn design fundamentals");

    for (const resource of resources) {
      expect(resource.takeaways!.points.length).toBeLessThanOrEqual(MAX_TAKEAWAY_POINTS);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- lib/ai/mock.test.ts`
Expected: FAIL — TypeScript reports `takeaways` missing on every object literal in `RESOURCES_BY_CATEGORY` and `GENERIC_RESOURCES`, since `AiResourceDTO.takeaways` is required.

- [ ] **Step 3: Add takeaways to every mock resource**

Replace lines 48-76 of `lib/ai/mock.ts` (the `RESOURCES_BY_CATEGORY` and `GENERIC_RESOURCES` declarations) with the following. The one-line-per-record style no longer fits, so records become multi-line.

```ts
const RESOURCES_BY_CATEGORY: Record<string, AiResourceDTO[]> = {
  Programming: [
    {
      kind: "book",
      title: "Structure and Interpretation of Computer Programs",
      author: "Abelson, Sussman",
      year: 1985,
      url: null,
      note: "Builds the mental models behind programming rather than one language.",
      takeaways: {
        points: [
          "Programs are best understood as ways of building abstractions, not as sequences of instructions",
          "Data and procedures are far less distinct than most languages suggest",
          "Recursion and higher-order functions replace most of the machinery you would otherwise hand-write",
          "Building an interpreter for a language is the fastest way to understand every language",
        ],
        fit: "Worth the effort if you already program and want the underlying theory; skip it if you need a working skill this month.",
      },
    },
    {
      kind: "book",
      title: "The Pragmatic Programmer",
      author: "Hunt, Thomas",
      year: 1999,
      url: null,
      note: "Day-to-day habits that separate working code from maintainable code.",
      takeaways: {
        points: [
          "Duplication is the root of most maintenance cost, in knowledge as much as in code",
          "Treat warnings, broken tests and small breakages as things to fix now, not later",
          "Automate anything you do more than twice, starting with your own workflow",
          "Estimate by narrowing a range out loud rather than guessing a single number",
        ],
        fit: "Best for someone already writing code professionally; too abstract if you are still learning your first language.",
      },
    },
    {
      kind: "course",
      title: "CS50: Introduction to Computer Science",
      author: "Harvard University",
      year: null,
      url: "https://cs50.harvard.edu/x/",
      note: "A broad, well-paced entry point into computing fundamentals.",
      takeaways: {
        points: [
          "Starts from C so memory, pointers and cost are visible before any framework hides them",
          "Covers algorithms, data structures, SQL and web development in one arc",
          "Problem sets are graded and demanding, which is what makes the material stick",
          "Ends with a self-directed final project rather than another exercise",
        ],
        fit: "Ideal as a first serious course in computing; redundant if you already ship software for a living.",
      },
    },
  ],
  Languages: [
    {
      kind: "book",
      title: "Fluent Forever",
      author: "Gabriel Wyner",
      year: 2014,
      url: null,
      note: "A concrete method for building vocabulary that actually sticks.",
      takeaways: {
        points: [
          "Learn the sound system first — pronunciation trained late is far harder to fix",
          "Attach words to images and personal memories instead of translations",
          "Spaced repetition works, but only with cards you built yourself",
          "Grammar is absorbed faster from example sentences than from rule tables",
        ],
        fit: "Good if you want a repeatable daily method; not the book to read if you only need travel phrases.",
      },
    },
    {
      kind: "book",
      title: "How Languages Are Learned",
      author: "Lightbown, Spada",
      year: 1993,
      url: null,
      note: "Explains why some study routines work and others waste time.",
      takeaways: {
        points: [
          "Adults and children learn languages by measurably different routes",
          "Correcting every error slows progress; targeted feedback helps",
          "Comprehensible input is necessary but on its own is not sufficient",
          "Popular beliefs about talent and critical periods are mostly unsupported",
        ],
        fit: "For learners who want to know why a method works, or for anyone teaching; skip if you want exercises today.",
      },
    },
  ],
  Mathematics: [
    {
      kind: "book",
      title: "How to Prove It",
      author: "Daniel J. Velleman",
      year: 1994,
      url: null,
      note: "Bridges the gap between computation and mathematical reasoning.",
      takeaways: {
        points: [
          "Logical structure tells you the shape of the proof before you have any ideas",
          "Quantifiers are the part beginners consistently get wrong",
          "Induction, contradiction and contraposition cover most of what you will need",
          "Set theory and relations give you the vocabulary for everything after",
        ],
        fit: "The right book before a first abstract algebra or analysis course; unnecessary if you only need applied calculation.",
      },
    },
    {
      kind: "course",
      title: "Khan Academy Mathematics",
      author: "Khan Academy",
      year: null,
      url: "https://www.khanacademy.org/math",
      note: "Fills specific gaps without committing to a whole curriculum.",
      takeaways: {
        points: [
          "Granular topics let you repair one weak area without restarting a course",
          "Diagnostic quizzes locate the actual gap rather than the assumed one",
          "Coverage runs from arithmetic through single-variable calculus and statistics",
          "Practice is unlimited, which suits drilling far better than a book does",
        ],
        fit: "Best for patching known gaps at your own pace; too shallow as preparation for proof-based mathematics.",
      },
    },
  ],
  Design: [
    {
      kind: "book",
      title: "The Design of Everyday Things",
      author: "Don Norman",
      year: 1988,
      url: null,
      note: "The vocabulary for talking about why an interface works.",
      takeaways: {
        points: [
          "Affordances and signifiers explain why a control is understood or misread",
          "A wrong mental model, not user error, causes most mistakes",
          "Feedback and discoverability matter more than visual polish",
          "Blaming the user is almost always a design failure in disguise",
        ],
        fit: "The foundation if you have never studied design; light on specifics if you want screen-level craft.",
      },
    },
    {
      kind: "book",
      title: "Refactoring UI",
      author: "Wathan, Schoger",
      year: 2018,
      url: null,
      note: "Practical rules you can apply to a screen the same day.",
      takeaways: {
        points: [
          "Start with hierarchy: decide what matters most, then let size and weight follow",
          "Spacing does more for clarity than borders and dividers",
          "Constrain yourself to a small scale of sizes, weights and shades",
          "Design the empty and overflowing states, not only the ideal one",
        ],
        fit: "Immediately useful for developers building their own interfaces; too tactical if you want design theory.",
      },
    },
  ],
  Business: [
    {
      kind: "book",
      title: "Thinking, Fast and Slow",
      author: "Daniel Kahneman",
      year: 2011,
      url: null,
      note: "Grounds business judgement in how decisions actually get made.",
      takeaways: {
        points: [
          "Two systems drive judgement: one fast and associative, one slow and effortful",
          "Anchoring, availability and framing distort decisions predictably",
          "Confidence tracks the coherence of a story, not the strength of evidence",
          "Losses are felt roughly twice as strongly as equivalent gains",
        ],
        fit: "Valuable if you make judgement calls under uncertainty; long and repetitive if you want practical tactics.",
      },
    },
    {
      kind: "book",
      title: "The Lean Startup",
      author: "Eric Ries",
      year: 2011,
      url: null,
      note: "A framework for testing an idea before building it out.",
      takeaways: {
        points: [
          "Treat every product assumption as a hypothesis with a cheap test attached",
          "Build-measure-learn cycles are only useful if the cycle is short",
          "A minimum viable product exists to answer one question, not to be small",
          "Vanity metrics hide the truth; cohort behaviour reveals it",
        ],
        fit: "Useful before committing months to an untested idea; thin if you already have customers and need depth.",
      },
    },
  ],
};

const GENERIC_RESOURCES: AiResourceDTO[] = [
  {
    kind: "book",
    title: "Make It Stick",
    author: "Brown, Roediger, McDaniel",
    year: 2014,
    url: null,
    note: "What the research says about how learning actually sticks.",
    takeaways: {
      points: [
        "Retrieving from memory builds durable knowledge; rereading mostly builds familiarity",
        "Spacing and interleaving feel worse while studying and work better afterwards",
        "Difficulty during practice is usually a sign it is working",
        "Fluency right after reading is the least reliable signal of learning",
      ],
      fit: "Read it early if you study regularly; skip it if you want subject material rather than method.",
    },
  },
  {
    kind: "book",
    title: "A Mind for Numbers",
    author: "Barbara Oakley",
    year: 2014,
    url: null,
    note: "Concrete study techniques for difficult material.",
    takeaways: {
      points: [
        "Focused and diffuse modes both matter; stepping away is part of the work",
        "Chunking turns solved problems into reusable single units",
        "Procrastination is best attacked as a habit loop, not as a willpower problem",
        "Working problems by hand beats reading worked solutions",
      ],
      fit: "Aimed at people who believe they are bad at maths or science; less useful if study habits are already solid.",
    },
  },
  {
    kind: "course",
    title: "Learning How to Learn",
    author: "McMaster University",
    year: null,
    url: "https://www.coursera.org/learn/learning-how-to-learn",
    note: "A short course on study strategy that pays for itself early.",
    takeaways: {
      points: [
        "Short and free enough to finish before a serious study block",
        "Covers memory, procrastination and test preparation in a few hours",
        "Gives concrete routines rather than general encouragement",
        "Overlaps heavily with A Mind for Numbers, in video form",
      ],
      fit: "Good as a quick primer before a long course; redundant if you have already read a book on learning.",
    },
  },
];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- lib/ai/mock.test.ts`
Expected: PASS.

- [ ] **Step 5: Extend the OpenAI schema and prompt**

In `lib/ai/openai.ts`, add `takeaways` to `RESOURCE_ITEM_SCHEMA`. The `required` array becomes:

```ts
  required: ["kind", "title", "author", "year", "url", "note", "takeaways"],
```

And add this property after `note`:

```ts
    takeaways: {
      type: "object",
      additionalProperties: false,
      required: ["points", "fit"],
      properties: {
        points: {
          type: "array",
          description:
            "4-6 substantive takeaways from the resource itself: the claims, methods or ideas a reader walks away with. Not a description of the resource.",
          items: { type: "string" },
        },
        fit: {
          type: "string",
          description:
            "One sentence naming who should spend time on this and who should skip it.",
        },
      },
    },
```

Then extend `RESOURCES_GUIDANCE` with two entries before the closing `].join(" ")`:

```ts
  "Each resource also needs takeaways: 4-6 concrete points a reader takes away from the material itself, not a restatement of the blurb.",
  "Takeaways also need a fit sentence: who should spend time on this resource and who should skip it.",
```

- [ ] **Step 6: Verify types and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (`lib/ai/openai.ts` has no unit tests — the strict schema is exercised only against the live API, so type and lint checks are the gate here.)

- [ ] **Step 7: Run the whole unit suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/ai/openai.ts lib/ai/mock.ts lib/ai/mock.test.ts
git commit -m "feat: ask AI for resource takeaways and fill in the mock"
```

---

### Task 4: Tooltip primitive

A thin Base UI wrapper matching the house style of `components/ui`. Separate from the feature so it can be reviewed as the reusable primitive it is.

**Files:**
- Create: `components/ui/tooltip.tsx`

**Interfaces:**
- Consumes: `cn` from `@/lib/utils`; `Tooltip` from `@base-ui/react/tooltip`.
- Produces: `Tooltip`, `TooltipTrigger`, `TooltipContent` exported from `@/components/ui/tooltip`. `TooltipTrigger` accepts Base UI's `render` prop for wrapping an existing element, and a `delay` prop in milliseconds (Base UI default is 600). `TooltipContent` renders its own Portal and Positioner and accepts `sideOffset`.

- [ ] **Step 1: Create the primitive**

Base UI's `Tooltip.Provider` is optional — it only shares open delays between sibling tooltips — so it is deliberately not used here.

```tsx
"use client"

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: TooltipPrimitive.Popup.Props & { sideOffset?: number }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner sideOffset={sideOffset}>
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "z-50 rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground ring-1 ring-foreground/10 origin-[var(--transform-origin)] transition-[transform,opacity] duration-100 data-instant:transition-none data-starting-style:opacity-0 data-starting-style:[transform:scale(0.98)] data-ending-style:opacity-0 data-ending-style:[transform:scale(0.98)]",
            className
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipTrigger }
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/tooltip.tsx
git commit -m "feat: add a tooltip primitive on Base UI"
```

---

### Task 5: Takeaways modal and reading-list icon

The visible feature. `ResourceList` gains the icon, the tooltip and one modal instance for the whole list; no call site changes.

**Files:**
- Create: `components/resource-takeaways-dialog.tsx`
- Modify: `components/resource-list.tsx`
- Test: `e2e/library.spec.ts`

**Interfaces:**
- Consumes: `LearningResource.takeaways` (Task 1); `Tooltip`, `TooltipTrigger`, `TooltipContent` (Task 4); existing `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle` from `@/components/ui/dialog`; existing `Button` from `@/components/ui/button`.
- Produces: `ResourceTakeawaysDialog` with props `{ resource: LearningResource | null; onClose: () => void }`. `ResourceListProps` is unchanged — this is the point of the design.

- [ ] **Step 1: Write the failing e2e tests**

Append to `e2e/library.spec.ts`. The existing `addLearningTaskWithReading` helper at the top of that file plans "Learn SQL basics over the next month", which the mock maps to the Programming resource set — all of which now carry takeaways.

```ts
test("a reading list entry opens its takeaways", async ({ page }) => {
  await addLearningTaskWithReading(page);

  await page.getByRole("tab", { name: /Library \(/ }).click();

  await page.getByRole("button", { name: /Key takeaways for ".*"/ }).first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Key takeaways")).toBeVisible();
  await expect(dialog.getByText("Good fit if")).toBeVisible();
  await expect(dialog.getByRole("listitem")).not.toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("takeaways open on top of the task details dialog", async ({ page }) => {
  await addLearningTaskWithReading(page);

  await page.getByText("Learn SQL basics over the next month").first().click();
  await expect(page.getByText("Reading list")).toBeVisible();

  await page.getByRole("button", { name: /Key takeaways for ".*"/ }).first().click();
  await expect(page.getByText("Good fit if")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByText("Good fit if")).toBeHidden();
  await expect(page.getByText("Reading list")).toBeVisible();
});
```

Two notes on these locators. The details dialog opens by clicking the task title, matching how `e2e/iteration2.spec.ts` does it (`page.getByText("Ship feature").click()`); the title comes from the mock's `parseIntent`, which uses the goal's first sentence verbatim. And the nested test anchors on `Good fit if` rather than counting `role=dialog` elements, because a nested Base UI dialog may `aria-hidden` its parent — which would make a count assertion fail for reasons that have nothing to do with this feature. `Good fit if` appears only in the takeaways modal and `Reading list` only in the details dialog, so both are unambiguous.

- [ ] **Step 2: Run the e2e tests to verify they fail**

Run: `npm run test:e2e -- library.spec.ts`
Expected: FAIL — no button matching `Key takeaways for "..."` exists yet.

- [ ] **Step 3: Create the modal**

```tsx
"use client";

import type { LearningResource } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ResourceTakeawaysDialogProps {
  resource: LearningResource | null;
  onClose: () => void;
}

export function ResourceTakeawaysDialog({
  resource,
  onClose,
}: ResourceTakeawaysDialogProps) {
  const takeaways = resource?.takeaways;
  const meta = resource
    ? [resource.author, resource.year].filter(Boolean).join(" · ")
    : "";

  return (
    <Dialog
      open={Boolean(takeaways)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6 break-words">
            {resource?.title}
          </DialogTitle>
          {meta ? <DialogDescription>{meta}</DialogDescription> : null}
        </DialogHeader>

        {takeaways ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Key takeaways
              </p>
              <ul className="list-disc space-y-1.5 pl-4">
                {takeaways.points.map((point) => (
                  <li key={point} className="break-words">
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Good fit if
              </p>
              <p className="break-words text-muted-foreground">
                {takeaways.fit}
              </p>
            </div>
          </div>
        ) : null}

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Wire the icon into the reading list**

In `components/resource-list.tsx`:

Change the lucide import to add `Lightbulb`:

```tsx
import { BookOpen, FileText, GraduationCap, Lightbulb, Trash2 } from "lucide-react";
```

Add these imports:

```tsx
import { useState } from "react";
import { ResourceTakeawaysDialog } from "@/components/resource-takeaways-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
```

Adjust the existing `import type { ReactNode } from "react";` line so React imports stay tidy — keep the type-only import separate as the file already does.

Inside the `ResourceList` function, above the `if (resources.length === 0) return null;` guard, add the state:

```tsx
  const [openTakeaways, setOpenTakeaways] = useState<LearningResource | null>(
    null,
  );
```

Note the guard must move below the hook — hooks cannot sit after a conditional return. The function body starts:

```tsx
  const [openTakeaways, setOpenTakeaways] = useState<LearningResource | null>(
    null,
  );

  if (resources.length === 0) return null;
```

Inside the `resources.map` callback, insert this block immediately before the `{onRemove ? (` block:

```tsx
            {resource.takeaways ? (
              <Tooltip>
                <TooltipTrigger
                  delay={200}
                  render={
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setOpenTakeaways(resource)}
                      aria-label={`Key takeaways for "${resource.title}"`}
                    />
                  }
                >
                  <Lightbulb />
                </TooltipTrigger>
                <TooltipContent>Key takeaways</TooltipContent>
              </Tooltip>
            ) : null}
```

Wrap the returned markup so the single dialog sits alongside the list. The outer `<div className="space-y-2">` becomes:

```tsx
  return (
    <>
      <div className="space-y-2">
        {resources.map((resource) => {
          /* unchanged body */
        })}
      </div>

      <ResourceTakeawaysDialog
        resource={openTakeaways}
        onClose={() => setOpenTakeaways(null)}
      />
    </>
  );
```

- [ ] **Step 5: Verify types and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 6: Run the e2e tests to verify they pass**

Run: `npm run test:e2e -- library.spec.ts`
Expected: PASS, including the two pre-existing Library tests.

- [ ] **Step 7: Run the full suite**

Run: `npm test && npm run test:e2e`
Expected: PASS. `e2e/ai.spec.ts` and `e2e/tasks.spec.ts` touch the same reading lists, so a regression there would show up here.

- [ ] **Step 8: Commit**

```bash
git add components/resource-takeaways-dialog.tsx components/resource-list.tsx e2e/library.spec.ts
git commit -m "feat: open resource takeaways from the reading list"
```

---

### Task 6: Update PROJECT_SPEC.md

The repository keeps `PROJECT_SPEC.md` (Ukrainian) in sync with the UI in dedicated commits. Two sections describe what a resource holds and what the Library row shows; both need the new field.

**Files:**
- Modify: `PROJECT_SPEC.md` (section 2.4 around lines 128-145, section 11 around line 478, section 16.3 around line 701, section 16.4 around lines 707-710)

**Interfaces:**
- Consumes: the finished behaviour from Tasks 1-5.
- Produces: nothing in code.

- [ ] **Step 1: Extend section 2.4 (Джерело для навчання)**

In the required-fields list, after `* ознаку «опрацьовано».`, add:

```
* вижимку — головні тейки та одне речення про те, кому джерело підійде.
```

Then, after the `Обов'язкові поля` block (which stays `тип`, `назва`, `пояснення` — the takeaways are optional), add a new paragraph:

```
Обмеження щодо вижимки

* вижимка складається з 4-6 тейків і одного речення «кому підійде»;
* вижимка приймається лише цілою: якщо після перевірки залишилось менше двох тейків або порожнє речення «кому підійде», поле відкидається повністю;
* джерело без вижимки залишається валідним — інтерфейс просто не показує для нього кнопку.
```

- [ ] **Step 2: Extend section 11 (блок «Рекомендована література»)**

The paragraph at line 478 describes the resource block inside the recommendations dialog. Append to it:

```
Джерело з вижимкою має кнопку, що відкриває її окремим вікном, — щоб користувач міг оцінити джерело до того, як відмітить його прапорцем.
```

- [ ] **Step 3: Extend section 16.3 (Вміст)**

Replace the sentence at line 701:

```
Кожен рядок містить назву (посилання, якщо воно є), тип, автора й рік, пояснення, назву задачі-джерела, прапорець «опрацьовано» та — якщо вижимка є — кнопку її відкриття.
```

- [ ] **Step 4: Extend section 16.4 (Дії)**

Add a bullet to the list:

```
* відкриття вижимки джерела окремим вікном — доступне всюди, де показується список літератури, у тому числі поверх уже відкритого вікна.
```

- [ ] **Step 5: Commit**

```bash
git add PROJECT_SPEC.md
git commit -m "docs: describe resource takeaways in the project spec"
```

---

## Definition of Done

- [ ] `npm test` passes.
- [ ] `npm run test:e2e` passes.
- [ ] `npx tsc --noEmit` reports no errors.
- [ ] `npm run lint` reports no errors.
- [ ] No code comments were added anywhere.
- [ ] All new user-facing strings are English.
- [ ] A resource saved before this change still loads and shows no takeaways icon.
