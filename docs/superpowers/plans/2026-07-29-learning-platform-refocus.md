# Learning Platform Refocus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refocus the app from a general task planner into a learning-planning platform whose two AI features additionally suggest vetted literature, collected in a per-user Library.

**Architecture:** No new subsystems. A new `LearningResource` value type hangs off `Task.resources`; a new server-side module `lib/ai/resources.ts` sanitizes model-produced URLs against a domain allowlist before they reach the browser; a single presentational `ResourceList` component serves four call sites; the Library tab is a derived view over `tasks.flatMap(t => t.resources)`, not a separate store.

**Tech Stack:** Next.js 16.2.6 (App Router), React 19.2.4, TypeScript, Tailwind 4, `@base-ui/react` primitives, `lucide-react` icons, OpenAI SDK v6 (chat completions + `strict` JSON schema), Vitest (jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-07-29-learning-platform-refocus-design.md`

## Global Constraints

- **No code comments.** The codebase contains none in application code; do not add any.
- **All UI text in English.** Plan documents and `PROJECT_SPEC.md` are Ukrainian; every user-visible string is English.
- **`localStorage` key stays `todo-ai:v1`.** Never change it. New fields are backfilled on read in `lib/storage.ts`.
- **`Task` and `Category` types are NOT renamed.** Only UI labels change (`Category` → `Subject`, `Deadline` → `Target date`, `Subtasks` → `Study steps`).
- **Books never carry a URL.** Enforced server-side in `sanitizeResourceUrl`, not by prompting alone.
- **`MAX_RESOURCES = 5`** per AI response.
- **OpenAI schemas use `strict: true`.** Every property must appear in `required`; optionality is expressed as `type: ["string", "null"]`, never by omission.
- **Display name is `StudyPath`.** Directory name and git remote are unchanged.
- **Existing patterns:** reducer actions are past-tense-free SCREAMING_SNAKE strings; components are function declarations with a props interface directly above; `cn()` for class merging; dialogs follow `components/ui/dialog.tsx`.
- **Before touching any Next.js API surface**, consult `node_modules/next/dist/docs/` — this Next version differs from training data. (Already verified for this plan: `Response.json` route handlers and `export const metadata: Metadata` are current and need no change.)

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `lib/ai/resources.ts` | URL allowlist, sanitization, dedupe, cap, ordering, DTO→`LearningResource` conversion |
| `lib/ai/resources.test.ts` | Unit tests for the above |
| `components/resource-list.tsx` | Single presentational list of resources; controls driven by which callbacks are passed |
| `components/library-tab.tsx` | Derived Library view grouped by kind |

**Modified:**

| File | Change |
|---|---|
| `types/index.ts` | `ResourceKind`, `LearningResource`, `AiResourceDTO`, `Task.resources`, `ActiveTab` + `"library"`, response shapes |
| `lib/storage.ts` | `normalizeResources`, three-way `activeTab` |
| `lib/tasks-reducer.ts` | `TaskPatch` + `resources`, `TOGGLE_RESOURCE_READ`, `REMOVE_RESOURCE` |
| `lib/tasks-reducer.test.ts` | Cases for the two new actions |
| `components/tasks-provider.tsx` | `TaskInput.resources`, `toggleResourceRead`, `removeResource` |
| `lib/ai/openai.ts` | Learning-domain prompts, resource schema, `offTopic` |
| `lib/ai/mock.ts` | Learning-flavoured mocks, `isLearningGoal`, `mockResources` |
| `lib/ai/provider.ts` | Return shapes |
| `app/api/ai/recommendations/route.ts` | Return sanitized `resources` |
| `app/api/ai/parse-intent/route.ts` | `422 off_topic`, return sanitized `resources` |
| `lib/ai/client.ts` | `off_topic` error code, DTO→`LearningResource` conversion |
| `components/task-form-dialog.tsx` | Copy, Reading list section |
| `components/task-details-dialog.tsx` | Copy, Reading list section |
| `components/ai-recommendations-dialog.tsx` | Copy, Recommended reading section |
| `components/ai-goal-dialog.tsx` | Copy, inline off-topic error |
| `components/app-shell.tsx` | Copy, third tab, wiring |
| `components/category-select.tsx` | Copy (`category` → `subject`) |
| `app/layout.tsx` | Metadata |
| `README.md`, `package.json` | Project identity |
| `PROJECT_SPEC.md` | Updated ТЗ |
| `e2e/*.spec.ts` | Updated labels, new scenarios |

`hooks/use-tasks.ts` needs no change — it returns the whole context value.

---

### Task 1: Resource types, storage migration, reducer actions

**Files:**
- Modify: `types/index.ts`
- Modify: `lib/storage.ts:16-61`
- Modify: `lib/tasks-reducer.ts:10-24`, `lib/tasks-reducer.ts:128-143`
- Modify: `components/tasks-provider.tsx:21-51`, `:91-158`, `:178-215`
- Test: `lib/tasks-reducer.test.ts`

**Interfaces:**
- Consumes: nothing (foundation task).
- Produces: `ResourceKind`, `LearningResource`, `AiResourceDTO` from `@/types`; reducer actions `{ type: "TOGGLE_RESOURCE_READ"; taskId: string; resourceId: string }` and `{ type: "REMOVE_RESOURCE"; taskId: string; resourceId: string }`; context methods `toggleResourceRead(taskId: string, resourceId: string): void` and `removeResource(taskId: string, resourceId: string): void`; `TaskInput.resources?: LearningResource[]`.

- [ ] **Step 1: Write the failing reducer tests**

Append to `lib/tasks-reducer.test.ts`, inside the existing `describe("tasksReducer", ...)` block:

```ts
  it("TOGGLE_RESOURCE_READ flips read without touching updatedAt or edited", () => {
    const task = baseTask({
      id: "t1",
      resources: [
        { id: "r1", kind: "book", title: "SICP", note: "Foundations.", read: false },
        { id: "r2", kind: "course", title: "CS50", note: "Broad intro.", read: false },
      ],
    });
    const next = tasksReducer(stateWith([task]), {
      type: "TOGGLE_RESOURCE_READ",
      taskId: "t1",
      resourceId: "r1",
    });
    const updated = next.tasks[0];
    expect(updated.resources[0].read).toBe(true);
    expect(updated.resources[1].read).toBe(false);
    expect(updated.updatedAt).toBe(task.updatedAt);
    expect(updated.edited).toBe(false);
  });

  it("REMOVE_RESOURCE drops only the targeted resource", () => {
    const task = baseTask({
      id: "t1",
      resources: [
        { id: "r1", kind: "book", title: "SICP", note: "Foundations.", read: false },
        { id: "r2", kind: "course", title: "CS50", note: "Broad intro.", read: false },
      ],
    });
    const next = tasksReducer(stateWith([task]), {
      type: "REMOVE_RESOURCE",
      taskId: "t1",
      resourceId: "r1",
    });
    expect(next.tasks[0].resources).toHaveLength(1);
    expect(next.tasks[0].resources[0].id).toBe("r2");
  });

  it("resource actions ignore unknown task ids", () => {
    const task = baseTask({
      id: "t1",
      resources: [
        { id: "r1", kind: "book", title: "SICP", note: "Foundations.", read: false },
      ],
    });
    const next = tasksReducer(stateWith([task]), {
      type: "REMOVE_RESOURCE",
      taskId: "nope",
      resourceId: "r1",
    });
    expect(next.tasks[0].resources).toHaveLength(1);
  });
```

Also add `resources: []` to the `baseTask` helper defaults at `lib/tasks-reducer.test.ts:9-22`, right after `subtasks: []`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- tasks-reducer`
Expected: FAIL — TypeScript errors on the unknown `resources` property and on the two unknown action types.

- [ ] **Step 3: Add the types**

In `types/index.ts`, after the `Subtask` interface:

```ts
export type ResourceKind = "book" | "article" | "course";

export interface LearningResource {
  id: string;
  kind: ResourceKind;
  title: string;
  author?: string;
  year?: number;
  url?: string;
  note: string;
  read: boolean;
}
```

Add to the `Task` interface, after `subtasks: Subtask[];`:

```ts
  resources: LearningResource[];
```

After the `AiRecommendationDTO` interface:

```ts
export interface AiResourceDTO {
  kind: ResourceKind;
  title: string;
  author: string | null;
  year: number | null;
  url: string | null;
  note: string;
}
```

Replace `AiRecommendationsResponse` and `AiParseResponse`:

```ts
export interface AiRecommendationsResponse {
  recommendations: AiRecommendationDTO[];
  resources: AiResourceDTO[];
}

export interface AiParseResponse {
  recommendation: AiRecommendationDTO;
  resources: AiResourceDTO[];
}
```

Replace the `ActiveTab` line:

```ts
export type ActiveTab = "active" | "done" | "library";
```

- [ ] **Step 4: Add the reducer actions**

In `lib/tasks-reducer.ts`, widen `TaskPatch`:

```ts
export type TaskPatch = Partial<
  Pick<
    Task,
    "title" | "description" | "categoryId" | "deadline" | "subtasks" | "resources"
  >
>;
```

Add to the `TasksAction` union, after the `TOGGLE_SUBTASK` member:

```ts
  | { type: "TOGGLE_RESOURCE_READ"; taskId: string; resourceId: string }
  | { type: "REMOVE_RESOURCE"; taskId: string; resourceId: string }
```

Add these cases after the existing `TOGGLE_SUBTASK` case:

```ts
    case "TOGGLE_RESOURCE_READ":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId
            ? {
                ...task,
                resources: task.resources.map((resource) =>
                  resource.id === action.resourceId
                    ? { ...resource, read: !resource.read }
                    : resource,
                ),
              }
            : task,
        ),
      };

    case "REMOVE_RESOURCE":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.taskId
            ? {
                ...task,
                resources: task.resources.filter(
                  (resource) => resource.id !== action.resourceId,
                ),
              }
            : task,
        ),
      };
```

- [ ] **Step 5: Run the reducer tests to verify they pass**

Run: `npm run test -- tasks-reducer`
Expected: PASS, all cases green.

- [ ] **Step 6: Backfill `resources` in storage**

In `lib/storage.ts`, add after `normalizeSubtasks`:

```ts
const RESOURCE_KINDS = new Set<ResourceKind>(["book", "article", "course"]);

function normalizeResources(value: unknown): LearningResource[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (r) =>
        r &&
        typeof r.title === "string" &&
        r.title.trim().length > 0 &&
        RESOURCE_KINDS.has(r.kind),
    )
    .map((r) => ({
      id: typeof r.id === "string" ? r.id : String(r.title),
      kind: r.kind as ResourceKind,
      title: r.title,
      author: typeof r.author === "string" ? r.author : undefined,
      year: typeof r.year === "number" ? r.year : undefined,
      url: typeof r.url === "string" ? r.url : undefined,
      note: typeof r.note === "string" ? r.note : "",
      read: Boolean(r.read),
    }));
}
```

Replace the type import on `lib/storage.ts:1` with exactly:

```ts
import type {
  ActiveTab,
  LearningResource,
  PersistedState,
  ResourceKind,
  Subtask,
  Task,
} from "@/types";
```

In `normalizeTasks`, add to the object built inside `list.map`:

```ts
    resources: normalizeResources(t.resources),
```

In `loadState`, replace the `activeTab` line:

```ts
      activeTab:
        parsed.activeTab === "done" || parsed.activeTab === "library"
          ? parsed.activeTab
          : "active",
```

- [ ] **Step 7: Wire the provider**

In `components/tasks-provider.tsx`:

Extend the type import to include `LearningResource`.

Add to `TaskInput`, after `subtasks?: Subtask[];`:

```ts
  resources?: LearningResource[];
```

Add to `TasksContextValue`, after `toggleSubtask`:

```ts
  toggleResourceRead: (taskId: string, resourceId: string) => void;
  removeResource: (taskId: string, resourceId: string) => void;
```

In `toPatch`, add after `subtasks: input.subtasks ?? [],`:

```ts
    resources: input.resources ?? [],
```

In `addTask`, add to the `task` object after `subtasks: input.subtasks ?? [],`:

```ts
        resources: input.resources ?? [],
```

Add the two callbacks after `toggleSubtask`:

```ts
  const toggleResourceRead = useCallback(
    (taskId: string, resourceId: string) => {
      dispatch({ type: "TOGGLE_RESOURCE_READ", taskId, resourceId });
    },
    [],
  );

  const removeResource = useCallback((taskId: string, resourceId: string) => {
    dispatch({ type: "REMOVE_RESOURCE", taskId, resourceId });
  }, []);
```

Add `toggleResourceRead` and `removeResource` to both the returned `value` object and its dependency array.

- [ ] **Step 8: Verify the whole unit suite and types**

Run: `npm run test && npx tsc --noEmit`
Expected: all unit tests PASS; `tsc` reports no errors.

- [ ] **Step 9: Commit**

```bash
git add types/index.ts lib/storage.ts lib/tasks-reducer.ts lib/tasks-reducer.test.ts components/tasks-provider.tsx
git commit -m "feat: add LearningResource type, storage backfill and resource reducer actions"
```

---

### Task 2: Resource sanitization module

**Files:**
- Create: `lib/ai/resources.ts`
- Create: `lib/ai/resources.test.ts`

**Interfaces:**
- Consumes: `AiResourceDTO`, `LearningResource`, `ResourceKind` from `@/types`; `newId` from `@/lib/id`.
- Produces:
  - `sanitizeResourceUrl(url: unknown, kind: ResourceKind): string | undefined`
  - `sanitizeResources(raw: unknown): AiResourceDTO[]`
  - `toLearningResources(dtos: AiResourceDTO[]): LearningResource[]`
  - `MAX_RESOURCES: number`

- [ ] **Step 1: Write the failing tests**

Create `lib/ai/resources.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- resources`
Expected: FAIL — cannot resolve `@/lib/ai/resources`.

- [ ] **Step 3: Implement the module**

Create `lib/ai/resources.ts`:

```ts
import type { AiResourceDTO, LearningResource, ResourceKind } from "@/types";
import { newId } from "@/lib/id";

export const MAX_RESOURCES = 5;

const MIN_YEAR = 1900;

const ALLOWED_HOSTS = [
  "coursera.org",
  "edx.org",
  "udacity.com",
  "khanacademy.org",
  "ocw.mit.edu",
  "mit.edu",
  "stanford.edu",
  "harvard.edu",
  "cs50.harvard.edu",
  "openstax.org",
  "developer.mozilla.org",
  "w3.org",
  "docs.python.org",
  "react.dev",
  "nextjs.org",
  "typescriptlang.org",
  "arxiv.org",
  "acm.org",
  "ieee.org",
  "nature.com",
  "freecodecamp.org",
  "github.com",
  "wikipedia.org",
  "oreilly.com",
  "manning.com",
  "pragprog.com",
];

const KIND_ORDER: Record<ResourceKind, number> = {
  book: 0,
  course: 1,
  article: 2,
};

const KINDS = new Set<ResourceKind>(["book", "article", "course"]);

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}

export function sanitizeResourceUrl(
  url: unknown,
  kind: ResourceKind,
): string | undefined {
  if (kind === "book") return undefined;
  if (typeof url !== "string" || url.trim().length === 0) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "https:") return undefined;
  if (!isAllowedHost(parsed.hostname)) return undefined;
  return url;
}

function sanitizeYear(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < MIN_YEAR || value > new Date().getFullYear() + 1) return null;
  return value;
}

function sanitizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function sanitizeResources(raw: unknown): AiResourceDTO[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const cleaned: AiResourceDTO[] = [];

  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const candidate = item as Record<string, unknown>;

    const kind = candidate.kind as ResourceKind;
    if (!KINDS.has(kind)) continue;

    const title = sanitizeText(candidate.title);
    if (title === null) continue;

    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    cleaned.push({
      kind,
      title,
      author: sanitizeText(candidate.author),
      year: sanitizeYear(candidate.year),
      url: sanitizeResourceUrl(candidate.url, kind) ?? null,
      note: sanitizeText(candidate.note) ?? "",
    });
  }

  return cleaned
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
    .slice(0, MAX_RESOURCES);
}

export function toLearningResources(
  dtos: AiResourceDTO[],
): LearningResource[] {
  return dtos.map((dto) => ({
    id: newId(),
    kind: dto.kind,
    title: dto.title,
    author: dto.author ?? undefined,
    year: dto.year ?? undefined,
    url: dto.url ?? undefined,
    note: dto.note,
    read: false,
  }));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- resources`
Expected: PASS, all cases green.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/resources.ts lib/ai/resources.test.ts
git commit -m "feat: add resource sanitization with domain allowlist"
```

---

### Task 3: Learning-domain prompts, schemas and mock provider

**Files:**
- Modify: `lib/ai/openai.ts` (whole file)
- Modify: `lib/ai/mock.ts` (whole file)
- Modify: `lib/ai/provider.ts:21-39`

**Interfaces:**
- Consumes: `sanitizeResources`, `MAX_RESOURCES` from `@/lib/ai/resources`; `AiResourceDTO` from `@/types`.
- Produces:
  - `generateRecommendations(body): Promise<{ recommendations: AiRecommendationDTO[]; resources: AiResourceDTO[] }>` from both `lib/ai/openai.ts` and `lib/ai/mock.ts`
  - `parseIntent(text): Promise<{ offTopic: boolean; recommendation: AiRecommendationDTO; resources: AiResourceDTO[] }>` from `lib/ai/openai.ts`; the mock exports the same shape synchronously-wrapped
  - `getRecommendations` / `getParsedIntent` from `lib/ai/provider.ts` with those same return shapes

- [ ] **Step 1: Add the resource schema and learning prompt to `lib/ai/openai.ts`**

Add the import:

```ts
import { MAX_RESOURCES, sanitizeResources } from "@/lib/ai/resources";
```

Add after `RECOMMENDATION_ITEM_SCHEMA`:

```ts
const RESOURCE_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "title", "author", "year", "url", "note"],
  properties: {
    kind: { type: "string", enum: ["book", "article", "course"] },
    title: { type: "string" },
    author: { type: ["string", "null"] },
    year: { type: ["integer", "null"] },
    url: {
      type: ["string", "null"],
      description:
        "Absolute https URL of a long-lived, well-known resource, or null when not certain it exists. Always null for books.",
    },
    note: {
      type: "string",
      description: "One sentence on what this resource gives the learner.",
    },
  },
} as const;

const RESOURCES_GUIDANCE = [
  `Also return between 3 and ${MAX_RESOURCES} learning resources for the topic.`,
  "Prefer books: well-known, widely available titles with a real author and publication year.",
  "Courses and articles may follow, but books must come first.",
  "Never invent a URL. Set url to null unless you are certain the exact address exists and is stable. Always set url to null for books.",
  "Each resource needs a note: one sentence on what it gives the learner for this specific topic.",
].join(" ");
```

Add to the properties of `RECOMMENDATIONS_SCHEMA`:

```ts
    resources: {
      type: "array",
      items: RESOURCE_ITEM_SCHEMA,
    },
```

and change its `required` to `["recommendations", "resources"]`.

- [ ] **Step 2: Rewrite the recommendations system prompt**

Replace the `system` array inside `generateRecommendations`:

```ts
  const system = [
    "You are a study-planning assistant for a learning platform.",
    `Today's date is ${today}.`,
    "Analyze what the user is currently learning and has already finished, then suggest between 3 and 5 next learning steps.",
    "Every suggestion must be a learning activity: study a topic, practise a skill, read up on something, build a project for practice, or prepare for an exam, interview or certification.",
    "Never suggest errands, chores, shopping or pure work admin. If the user's history contains such entries, ignore them, or reinterpret them through a learning lens only when that is natural.",
    "Suggestions must build on the user's actual history. Do not invent unrelated topics.",
    "For each suggestion set: a short title, a concise description, a category (a short subject label or null), a deadline (YYYY-MM-DD in the future, or null when a deadline is not useful), a reason explaining why it fits what the user is learning, and subtasks.",
    "For subtasks: include 5-10 ordered study steps when the task naturally breaks down, otherwise return an empty array.",
    RESOURCES_GUIDANCE,
    "Respond only with data matching the provided JSON schema.",
  ].join(" ");
```

- [ ] **Step 3: Return sanitized resources from `generateRecommendations`**

Change the `RawRecommendation` parse block and return:

```ts
  const parsed = parseContent<{
    recommendations: RawRecommendation[];
    resources: unknown;
  }>(response.choices[0]?.message.content ?? null);

  const recommendations: AiRecommendationDTO[] = (
    parsed.recommendations ?? []
  ).map((item) => ({ ...item, type: "history_based" }));

  return { recommendations, resources: sanitizeResources(parsed.resources) };
```

Update the function signature to:

```ts
export async function generateRecommendations(
  body: RecommendationsRequestBody,
): Promise<{
  recommendations: AiRecommendationDTO[];
  resources: AiResourceDTO[];
}> {
```

and add `AiResourceDTO` to the type import at the top of the file.

- [ ] **Step 4: Rewrite `parseIntent` with off-topic detection**

Add above `parseIntent`:

```ts
const PARSE_INTENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["offTopic", "recommendation", "resources"],
  properties: {
    offTopic: {
      type: "boolean",
      description:
        "True when the goal is not about learning, studying or acquiring a skill.",
    },
    recommendation: RECOMMENDATION_ITEM_SCHEMA,
    resources: { type: "array", items: RESOURCE_ITEM_SCHEMA },
  },
} as const;
```

Replace the body of `parseIntent`:

```ts
export async function parseIntent(text: string): Promise<{
  offTopic: boolean;
  recommendation: AiRecommendationDTO;
  resources: AiResourceDTO[];
}> {
  const today = todayISODate();
  const system = [
    "You turn a user's learning goal into one structured study task.",
    `Today's date is ${today}.`,
    "First decide whether the goal is about learning: studying a topic, acquiring or practising a skill or language, preparing for an exam, interview or certification, reading up on a subject, or building a project for the sake of practice.",
    "If it is not a learning goal (a chore, an errand, a purchase, a work assignment with no learning in it), set offTopic to true and fill the remaining fields with empty strings, nulls and empty arrays.",
    "If it is a learning goal, set offTopic to false and fill everything in.",
    "Set: a short actionable title, a concise description, a category (a short subject label or null), a deadline (YYYY-MM-DD, derived from any timeframe the user mentions, otherwise null), a reason explaining how the task matches the goal, and subtasks.",
    "For subtasks: include 5-10 ordered study steps.",
    RESOURCES_GUIDANCE,
    "Respond only with data matching the provided JSON schema.",
  ].join(" ");

  const response = await getClient().chat.completions.create({
    model: getModel(),
    messages: [
      { role: "system", content: system },
      { role: "user", content: text },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "learning_goal_plan",
        strict: true,
        schema: PARSE_INTENT_SCHEMA,
      },
    },
  });

  const raw = parseContent<{
    offTopic: boolean;
    recommendation: RawRecommendation;
    resources: unknown;
  }>(response.choices[0]?.message.content ?? null);

  if (raw.offTopic) {
    return {
      offTopic: true,
      recommendation: {
        title: "",
        description: "",
        category: null,
        deadline: null,
        reason: "",
        subtasks: [],
        type: "prompt_based",
      },
      resources: [],
    };
  }

  const recommendation: AiRecommendationDTO = {
    ...raw.recommendation,
    type: "prompt_based",
  };

  if (!isRecommendationDTO(recommendation, "prompt_based")) {
    throw new Error("invalid_response");
  }

  return {
    offTopic: false,
    recommendation,
    resources: sanitizeResources(raw.resources),
  };
}
```

- [ ] **Step 5: Rewrite the mock provider**

In `lib/ai/mock.ts`, replace `CATEGORY_KEYWORDS` with learning subjects:

```ts
const CATEGORY_KEYWORDS: Array<{ category: string; words: string[] }> = [
  { category: "Programming", words: ["code", "programming", "javascript", "typescript", "python", "react", "algorithm", "database", "sql"] },
  { category: "Languages", words: ["language", "english", "german", "spanish", "vocabulary", "grammar", "ielts", "toefl"] },
  { category: "Mathematics", words: ["math", "algebra", "calculus", "statistics", "probability", "linear"] },
  { category: "Design", words: ["design", "ux", "ui", "typography", "figma"] },
  { category: "Business", words: ["business", "management", "marketing", "finance", "economics"] },
];
```

Add after it:

```ts
const LEARNING_KEYWORDS = [
  "learn", "study", "master", "course", "exam", "read", "practice", "practise",
  "prepare", "understand", "tutorial", "skill", "language", "certification",
  "revise", "basics", "fundamentals", "training", "lecture", "research",
];

function isLearningGoal(text: string): boolean {
  const lower = text.toLowerCase();
  return LEARNING_KEYWORDS.some((word) => lower.includes(word));
}

const RESOURCES_BY_CATEGORY: Record<string, AiResourceDTO[]> = {
  Programming: [
    { kind: "book", title: "Structure and Interpretation of Computer Programs", author: "Abelson, Sussman", year: 1985, url: null, note: "Builds the mental models behind programming rather than one language." },
    { kind: "book", title: "The Pragmatic Programmer", author: "Hunt, Thomas", year: 1999, url: null, note: "Day-to-day habits that separate working code from maintainable code." },
    { kind: "course", title: "CS50: Introduction to Computer Science", author: "Harvard University", year: null, url: "https://cs50.harvard.edu/x/", note: "A broad, well-paced entry point into computing fundamentals." },
  ],
  Languages: [
    { kind: "book", title: "Fluent Forever", author: "Gabriel Wyner", year: 2014, url: null, note: "A concrete method for building vocabulary that actually sticks." },
    { kind: "book", title: "How Languages Are Learned", author: "Lightbown, Spada", year: 1993, url: null, note: "Explains why some study routines work and others waste time." },
  ],
  Mathematics: [
    { kind: "book", title: "How to Prove It", author: "Daniel J. Velleman", year: 1994, url: null, note: "Bridges the gap between computation and mathematical reasoning." },
    { kind: "course", title: "Khan Academy Mathematics", author: "Khan Academy", year: null, url: "https://www.khanacademy.org/math", note: "Fills specific gaps without committing to a whole curriculum." },
  ],
  Design: [
    { kind: "book", title: "The Design of Everyday Things", author: "Don Norman", year: 1988, url: null, note: "The vocabulary for talking about why an interface works." },
    { kind: "book", title: "Refactoring UI", author: "Wathan, Schoger", year: 2018, url: null, note: "Practical rules you can apply to a screen the same day." },
  ],
  Business: [
    { kind: "book", title: "Thinking, Fast and Slow", author: "Daniel Kahneman", year: 2011, url: null, note: "Grounds business judgement in how decisions actually get made." },
    { kind: "book", title: "The Lean Startup", author: "Eric Ries", year: 2011, url: null, note: "A framework for testing an idea before building it out." },
  ],
};

const GENERIC_RESOURCES: AiResourceDTO[] = [
  { kind: "book", title: "Make It Stick", author: "Brown, Roediger, McDaniel", year: 2014, url: null, note: "What the research says about how learning actually sticks." },
  { kind: "book", title: "A Mind for Numbers", author: "Barbara Oakley", year: 2014, url: null, note: "Concrete study techniques for difficult material." },
  { kind: "course", title: "Learning How to Learn", author: "McMaster University", year: null, url: "https://www.coursera.org/learn/learning-how-to-learn", note: "A short course on study strategy that pays for itself early." },
];

function mockResources(category: string | null): AiResourceDTO[] {
  return category ? RESOURCES_BY_CATEGORY[category] ?? GENERIC_RESOURCES : GENERIC_RESOURCES;
}
```

Add `AiResourceDTO` to the type import at the top.

Replace the five `recs.push` templates in `generateRecommendations` with learning-flavoured ones:

```ts
  if (lastCompleted) {
    recs.push({
      title: `Review what you learned in "${lastCompleted.title}"`,
      description: `Go back over "${lastCompleted.title}" and turn it into notes you can revisit. Spaced review is what moves it into long-term memory.`,
      category: lastCompleted.category ?? topCategory,
      deadline: addDays(7),
      reason: `You recently finished "${lastCompleted.title}", and reviewing it now is when review pays off most.`,
      type: "history_based",
    });
  }

  if (topCategory) {
    recs.push({
      title: `Practise ${topCategory.toLowerCase()} with a small project`,
      description: `Most of your studying is in ${topCategory}. Build something small that forces you to use it end to end.`,
      category: topCategory,
      deadline: addDays(14),
      reason: `${topCategory} is your main subject, and applying it is the fastest way to find the gaps.`,
      type: "history_based",
    });
  }

  if (firstActive) {
    recs.push({
      title: `Break "${firstActive.title}" into study sessions`,
      description: `Split "${firstActive.title}" into 3-5 focused sessions with a clear outcome for each.`,
      category: firstActive.category ?? topCategory,
      deadline: null,
      reason: `"${firstActive.title}" is still open; smaller sessions make it much easier to actually start.`,
      type: "history_based",
    });
  }

  recs.push({
    title: "Test yourself on last week's material",
    description:
      "Spend 20 minutes recalling last week's material from memory before checking your notes.",
    category: topCategory,
    deadline: addDays(2),
    reason:
      "Active recall is more effective than re-reading, and it shows you exactly what has not stuck.",
    type: "history_based",
  });

  recs.push({
    title: "Pick the next topic to study",
    description:
      "Choose one topic you keep postponing and schedule the first session for it this week.",
    category: null,
    deadline: addDays(5),
    reason:
      "Deciding the next topic in advance removes the friction that usually stops the next session.",
    type: "history_based",
  });
```

Change the return of the mock `generateRecommendations`:

```ts
  return {
    recommendations: recs
      .slice(0, 5)
      .map((rec) => ({ ...rec, subtasks: decompose(rec.title) })),
    resources: mockResources(topCategory),
  };
```

and its signature to `): { recommendations: AiRecommendationDTO[]; resources: AiResourceDTO[] } {`.

Replace the mock `parseIntent` return:

```ts
export function parseIntent(text: string): {
  offTopic: boolean;
  recommendation: AiRecommendationDTO;
  resources: AiResourceDTO[];
} {
  const trimmed = text.trim();

  if (!isLearningGoal(trimmed)) {
    return {
      offTopic: true,
      recommendation: {
        title: "",
        description: "",
        category: null,
        deadline: null,
        reason: "",
        subtasks: [],
        type: "prompt_based",
      },
      resources: [],
    };
  }

  const firstSentence = trimmed.split(/[.!?\n]/)[0]?.trim() || trimmed;
  const title =
    firstSentence.length > 80
      ? `${firstSentence.slice(0, 77)}...`
      : firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1);

  const lower = trimmed.toLowerCase();
  let deadline: string | null = null;
  if (lower.includes("today")) deadline = addDays(0);
  else if (lower.includes("tomorrow")) deadline = addDays(1);
  else if (lower.includes("week")) deadline = addDays(7);
  else if (lower.includes("month")) deadline = addDays(30);

  const category = guessCategory(trimmed);

  return {
    offTopic: false,
    recommendation: {
      title,
      description: `Turn your learning goal into a study plan: ${trimmed}`,
      category,
      deadline,
      reason:
        "This plan captures the goal you described and gives you a first study session you can start from.",
      subtasks: decompose(trimmed),
      type: "prompt_based",
    },
    resources: mockResources(category),
  };
}
```

Also update `decompose` so the fallback is never empty for a learning goal — replace its final `return [];` with:

```ts
  return [
    "Map out what the topic covers",
    "Pick one primary source to work through",
    "Study in focused sessions",
    "Test yourself without notes",
    "Note what still feels unclear",
  ];
```

- [ ] **Step 6: Update the provider signatures**

In `lib/ai/provider.ts`, replace both functions:

```ts
export async function getRecommendations(
  body: RecommendationsRequestBody,
): Promise<{
  recommendations: AiRecommendationDTO[];
  resources: AiResourceDTO[];
}> {
  if (hasOpenAIKey()) {
    return openaiRecs(body);
  }
  await delay(MOCK_DELAY_MS);
  return mockRecs(body);
}

export async function getParsedIntent(text: string): Promise<{
  offTopic: boolean;
  recommendation: AiRecommendationDTO;
  resources: AiResourceDTO[];
}> {
  if (hasOpenAIKey()) {
    return openaiParse(text);
  }
  await delay(MOCK_DELAY_MS);
  return mockParse(text);
}
```

Add `AiResourceDTO` to the type import.

- [ ] **Step 7: Verify types compile**

Run: `npx tsc --noEmit`
Expected: errors ONLY in `app/api/ai/*/route.ts` (they still destructure the old shapes) — those are fixed in Task 4. No errors inside `lib/ai/`.

- [ ] **Step 8: Commit**

```bash
git add lib/ai/openai.ts lib/ai/mock.ts lib/ai/provider.ts
git commit -m "feat: narrow AI prompts to the learning domain and return literature"
```

---

### Task 4: Routes and API client

**Files:**
- Modify: `app/api/ai/recommendations/route.ts:31-46`
- Modify: `app/api/ai/parse-intent/route.ts:19-31`
- Modify: `lib/ai/client.ts`

**Interfaces:**
- Consumes: `getRecommendations`, `getParsedIntent` from Task 3; `toLearningResources` from Task 2.
- Produces:
  - `requestRecommendations(body): Promise<{ recommendations: AiRecommendationDTO[]; resources: LearningResource[] }>`
  - `requestParseIntent(text): Promise<{ recommendation: AiRecommendationDTO; resources: LearningResource[] }>`
  - `AiErrorCode` now includes `"off_topic"`

- [ ] **Step 1: Update the recommendations route**

In `app/api/ai/recommendations/route.ts`, replace everything from `let recommendations;` to the end of `POST`:

```ts
  let result;
  try {
    result = await getRecommendations({
      activeTasks: data.activeTasks,
      completedTasks: data.completedTasks,
    });
  } catch {
    return Response.json({ error: "upstream" }, { status: 503 });
  }

  if (!isRecommendationList(result.recommendations)) {
    return Response.json({ error: "invalid_response" }, { status: 502 });
  }

  return Response.json({
    recommendations: result.recommendations,
    resources: result.resources,
  });
```

`result.resources` is already sanitized by the provider layer, so no extra validation is needed here.

- [ ] **Step 2: Update the parse-intent route**

In `app/api/ai/parse-intent/route.ts`, replace everything from `let recommendation;` to the end of `POST`:

```ts
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
```

The `offTopic` check must come before the DTO check — on refusal the recommendation fields are deliberately empty and would fail validation.

- [ ] **Step 3: Update the API client**

In `lib/ai/client.ts`:

```ts
export type AiErrorCode = "network" | "invalid" | "off_topic";
```

```ts
export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  network: "Couldn't get a response from AI. Please try again.",
  invalid: "AI returned invalid data. Please try again.",
  off_topic:
    'This planner is for learning goals. Try something like "Learn SQL basics" or "Prepare for the IELTS exam".',
};
```

In `postJson`, replace the `!response.ok` branch:

```ts
  if (!response.ok) {
    if (response.status === 422) throw new AiError("off_topic");
    throw new AiError(response.status === 502 ? "invalid" : "network");
  }
```

Replace both request functions:

```ts
export async function requestRecommendations(
  body: RecommendationsRequestBody,
): Promise<{
  recommendations: AiRecommendationDTO[];
  resources: LearningResource[];
}> {
  const data = (await postJson("/api/ai/recommendations", body)) as {
    recommendations?: unknown;
    resources?: unknown;
  };
  if (!isRecommendationList(data.recommendations)) {
    throw new AiError("invalid");
  }
  return {
    recommendations: data.recommendations,
    resources: toLearningResources(sanitizeResources(data.resources)),
  };
}

export async function requestParseIntent(text: string): Promise<{
  recommendation: AiRecommendationDTO;
  resources: LearningResource[];
}> {
  const data = (await postJson("/api/ai/parse-intent", { text })) as {
    recommendation?: unknown;
    resources?: unknown;
  };
  if (!isRecommendationDTO(data.recommendation, "prompt_based")) {
    throw new AiError("invalid");
  }
  return {
    recommendation: data.recommendation,
    resources: toLearningResources(sanitizeResources(data.resources)),
  };
}
```

Add the imports:

```ts
import type { LearningResource } from "@/types";
import { sanitizeResources, toLearningResources } from "@/lib/ai/resources";
```

Re-running `sanitizeResources` on the client is deliberate: the browser must not trust the response body, and the function is pure and cheap.

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: errors ONLY in `components/app-shell.tsx` and `components/ai-goal-dialog.tsx`, which still consume the old client return shapes. Nothing in `lib/` or `app/`.

- [ ] **Step 5: Commit**

```bash
git add app/api/ai lib/ai/client.ts
git commit -m "feat: return literature from AI routes and reject non-learning goals"
```

---

### Task 5: ResourceList component, task form and task details

**Files:**
- Create: `components/resource-list.tsx`
- Modify: `components/task-form-dialog.tsx`
- Modify: `components/task-details-dialog.tsx`

**Interfaces:**
- Consumes: `LearningResource`, `ResourceKind` from `@/types`.
- Produces: `ResourceList` component with props `{ resources, selectedIds?, savedIds?, onToggleSelect?, onToggleRead?, onRemove?, renderSource? }`; `TaskFormPrefill.resources?: LearningResource[]`; `TaskDetailsDialogProps.onToggleResourceRead: (taskId: string, resourceId: string) => void`.

- [ ] **Step 1: Create the component**

Create `components/resource-list.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import { BookOpen, FileText, GraduationCap, Trash2 } from "lucide-react";
import type { LearningResource, ResourceKind } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const KIND_LABELS: Record<ResourceKind, string> = {
  book: "Book",
  course: "Course",
  article: "Article",
};

const KIND_ICONS: Record<ResourceKind, typeof BookOpen> = {
  book: BookOpen,
  course: GraduationCap,
  article: FileText,
};

interface ResourceListProps {
  resources: LearningResource[];
  selectedIds?: Set<string>;
  savedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleRead?: (id: string) => void;
  onRemove?: (id: string) => void;
  renderSource?: (id: string) => ReactNode;
}

export function ResourceList({
  resources,
  selectedIds,
  savedIds,
  onToggleSelect,
  onToggleRead,
  onRemove,
  renderSource,
}: ResourceListProps) {
  if (resources.length === 0) return null;

  return (
    <div className="space-y-2">
      {resources.map((resource) => {
        const Icon = KIND_ICONS[resource.kind];
        const saved = savedIds?.has(resource.id) ?? false;
        const meta = [resource.author, resource.year]
          .filter(Boolean)
          .join(" · ");

        return (
          <div
            key={resource.id}
            className={
              "flex items-start gap-2 rounded-lg border p-2.5 text-sm" +
              (saved ? " opacity-60" : "")
            }
          >
            {onToggleSelect ? (
              <Checkbox
                className="mt-0.5"
                checked={selectedIds?.has(resource.id) ?? false}
                disabled={saved}
                onCheckedChange={() => onToggleSelect(resource.id)}
                aria-label={`Include "${resource.title}"`}
              />
            ) : onToggleRead ? (
              <Checkbox
                className="mt-0.5"
                checked={resource.read}
                onCheckedChange={() => onToggleRead(resource.id)}
                aria-label={`Mark "${resource.title}" as read`}
              />
            ) : (
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            )}

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {resource.url ? (
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium break-words underline underline-offset-2"
                  >
                    {resource.title}
                  </a>
                ) : (
                  <span className="font-medium break-words">
                    {resource.title}
                  </span>
                )}
                <Badge variant="secondary" className="gap-1">
                  <Icon className="size-3" />
                  {KIND_LABELS[resource.kind]}
                </Badge>
                {saved ? <Badge variant="outline">Saved</Badge> : null}
              </div>

              {meta ? (
                <p className="text-xs text-muted-foreground">{meta}</p>
              ) : null}

              {resource.note ? (
                <p className="text-xs text-muted-foreground break-words">
                  {resource.note}
                </p>
              ) : null}

              {renderSource ? renderSource(resource.id) : null}
            </div>

            {onRemove ? (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => onRemove(resource.id)}
                aria-label={`Remove "${resource.title}"`}
              >
                <Trash2 />
              </Button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Add the reading list to the task form**

In `components/task-form-dialog.tsx`:

Add imports:

```tsx
import type { Category, LearningResource, Subtask, Task } from "@/types";
import { ResourceList } from "@/components/resource-list";
```

Add to `TaskFormPrefill`:

```ts
  resources?: LearningResource[];
```

Add state in `TaskFormBody`, after the `subtasks` state:

```tsx
  const [resources, setResources] = useState<LearningResource[]>(() =>
    task ? task.resources : prefill?.resources ?? [],
  );
```

In `handleSubmit`, pass resources through:

```tsx
    onSubmit({
      title,
      description,
      categoryId,
      deadline,
      subtasks: cleanedSubtasks,
      resources,
    });
```

Add the section after the Subtasks block, still inside the `space-y-4` div:

```tsx
        {resources.length > 0 ? (
          <div className="space-y-1.5">
            <Label>Reading list</Label>
            <ResourceList
              resources={resources}
              onRemove={(id) =>
                setResources((prev) => prev.filter((r) => r.id !== id))
              }
            />
          </div>
        ) : null}
```

- [ ] **Step 3: Add the reading list to task details**

In `components/task-details-dialog.tsx`:

Add the import `import { ResourceList } from "@/components/resource-list";`.

Add to `TaskDetailsDialogProps`:

```ts
  onToggleResourceRead: (taskId: string, resourceId: string) => void;
```

Add it to the destructured props.

Add after the closing of the subtasks block, before the `task.aiReason` block:

```tsx
          {task.resources.length > 0 ? (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Reading list</p>
                  <span className="text-xs text-muted-foreground">
                    {task.resources.filter((r) => r.read).length}/
                    {task.resources.length} read
                  </span>
                </div>
                <ResourceList
                  resources={task.resources}
                  onToggleRead={(resourceId) =>
                    onToggleResourceRead(task.id, resourceId)
                  }
                />
              </div>
            </>
          ) : null}
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: the only remaining errors are in `components/app-shell.tsx` (missing `onToggleResourceRead` prop, old client shapes) and `components/ai-goal-dialog.tsx`. Fixed in Tasks 6-7.

- [ ] **Step 5: Commit**

```bash
git add components/resource-list.tsx components/task-form-dialog.tsx components/task-details-dialog.tsx
git commit -m "feat: add ResourceList and reading list in task form and details"
```

---

### Task 6: Recommended reading in the recommendations dialog

**Files:**
- Modify: `components/ai-recommendations-dialog.tsx`

**Interfaces:**
- Consumes: `ResourceList` from Task 5; `LearningResource` from `@/types`.
- Produces: `AiRecommendationsDialogProps` gains `resources: LearningResource[]`, `savedResourceIds: Set<string>`, and changes `onSelect` to `(rec: AiRecommendationDTO, resources: LearningResource[]) => void`.

- [ ] **Step 1: Update the props and add selection state**

In `components/ai-recommendations-dialog.tsx`:

Add imports:

```tsx
import { useEffect, useState } from "react";
import type { AiRecommendationDTO, LearningResource } from "@/types";
import { ResourceList } from "@/components/resource-list";
```

Replace `AiRecommendationsDialogProps`:

```ts
interface AiRecommendationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: RecommendationsStatus;
  recommendations: AiRecommendationDTO[];
  resources: LearningResource[];
  savedResourceIds: Set<string>;
  onSelect: (rec: AiRecommendationDTO, resources: LearningResource[]) => void;
  onReject: (index: number) => void;
  onRetry: () => void;
}
```

Add the constant near `NOT_ENOUGH_HISTORY_MESSAGE`:

```ts
const READING_HINT =
  "Books and courses for what you are studying. Checked items go with the task you add.";
```

Inside the component, add selection state that resets whenever a new set of resources arrives:

```tsx
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedIds(new Set(resources.map((r) => r.id)));
  }, [resources]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectedResources(): LearningResource[] {
    return resources.filter(
      (r) => selectedIds.has(r.id) && !savedResourceIds.has(r.id),
    );
  }
```

- [ ] **Step 2: Render the section**

Change the card's `onSelect` wiring to pass the selection:

```tsx
                  onSelect={() => onSelect(rec, selectedResources())}
```

Add after the closing of the `status === "ready"` block, as a sibling inside `DialogContent`:

```tsx
        {status === "ready" && resources.length > 0 ? (
          <div className="space-y-2 border-t pt-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Recommended reading</p>
              <p className="text-xs text-muted-foreground">{READING_HINT}</p>
            </div>
            <ResourceList
              resources={resources}
              selectedIds={selectedIds}
              savedIds={savedResourceIds}
              onToggleSelect={toggleSelected}
            />
          </div>
        ) : null}
```

The section renders only in the `ready` state — during `loading`, `insufficient` and `error` there is nothing meaningful to show.

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: errors remain only in `components/app-shell.tsx` (does not yet pass the new props) and `components/ai-goal-dialog.tsx`.

- [ ] **Step 4: Commit**

```bash
git add components/ai-recommendations-dialog.tsx
git commit -m "feat: show recommended reading with per-item selection"
```

---

### Task 7: Off-topic handling in the goal dialog and app-shell wiring

**Files:**
- Modify: `components/ai-goal-dialog.tsx`
- Modify: `components/app-shell.tsx`

**Interfaces:**
- Consumes: everything from Tasks 4-6.
- Produces: `AiGoalDialogProps.onResult: (dto: AiRecommendationDTO, resources: LearningResource[]) => void`; app-shell state `recResources: LearningResource[]`, `savedResourceIds: Set<string>`.

- [ ] **Step 1: Handle `off_topic` inline in the goal dialog**

In `components/ai-goal-dialog.tsx`:

Add imports:

```tsx
import type { AiRecommendationDTO, LearningResource } from "@/types";
import { AiError, aiErrorMessage, requestParseIntent } from "@/lib/ai/client";
```

Change the props interface:

```ts
interface AiGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResult: (dto: AiRecommendationDTO, resources: LearningResource[]) => void;
}
```

Replace the `generate` function body's try/catch:

```tsx
    try {
      const { recommendation, resources } = await requestParseIntent(text);
      onResult(recommendation, resources);
      setText("");
    } catch (err) {
      if (err instanceof AiError && err.code === "off_topic") {
        setError(aiErrorMessage(err));
      } else {
        toast.error(aiErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
```

The off-topic message goes into the existing inline `error` state so the user sees the examples right next to the field they need to rewrite; every other failure stays a toast.

- [ ] **Step 2: Wire the app shell**

In `components/app-shell.tsx`:

Add `LearningResource` to the type import and `ResourceList` is not needed here.

Add state next to the existing recommendation state:

```tsx
  const [recResources, setRecResources] = useState<LearningResource[]>([]);
  const [savedResourceIds, setSavedResourceIds] = useState<Set<string>>(
    new Set(),
  );
```

Extend `dtoToPrefill` to accept resources:

```tsx
function dtoToPrefill(
  dto: AiRecommendationDTO,
  resources: LearningResource[],
): TaskFormPrefill {
  return {
    title: dto.title,
    description: dto.description,
    deadline: dto.deadline ?? undefined,
    suggestedCategoryName: dto.category ?? undefined,
    subtasks: dto.subtasks.map((title) => ({ id: newId(), title, done: false })),
    resources,
  };
}
```

Add a field to the `proposed` variant of `FormConfig`:

```ts
  | {
      mode: "proposed";
      prefill: TaskFormPrefill;
      aiReason?: string;
      source: TaskSource;
      resourceIds: string[];
      onBack?: () => void;
    };
```

Replace `fetchRecommendations`:

```tsx
  async function fetchRecommendations() {
    setRecStatus("loading");
    try {
      const { recommendations: recs, resources } = await requestRecommendations({
        activeTasks: toSnapshots(activeTasks, getCategoryName),
        completedTasks: toSnapshots(doneTasks, getCategoryName),
      });
      setRecommendations(recs);
      setRecResources(resources);
      setSavedResourceIds(new Set());
      setRecStatus("ready");
    } catch (error) {
      toast.error(aiErrorMessage(error));
      setRecStatus("error");
    }
  }
```

Add `setRecResources([])` next to the existing `setRecommendations([])` inside `openRecommendations`.

Replace `handlePromptResult` and `selectRecommendation`:

```tsx
  function handlePromptResult(
    dto: AiRecommendationDTO,
    resources: LearningResource[],
  ) {
    setGoalOpen(false);
    setFormConfig({
      mode: "proposed",
      prefill: dtoToPrefill(dto, resources),
      aiReason: dto.reason,
      source: "ai_prompt",
      resourceIds: [],
    });
  }

  function selectRecommendation(
    rec: AiRecommendationDTO,
    resources: LearningResource[],
  ) {
    setRecsOpen(false);
    setFormConfig({
      mode: "proposed",
      prefill: dtoToPrefill(rec, resources),
      aiReason: rec.reason,
      source: "ai_recommendation",
      resourceIds: resources.map((r) => r.id),
      onBack: () => {
        setFormConfig(null);
        setRecsOpen(true);
      },
    });
  }
```

`resourceIds` is empty for the prompt flow because that dialog has no persistent reading list to mark as saved.

In `handleFormSubmit`, mark the consumed resources as saved:

```tsx
    if (formConfig.mode === "proposed") {
      addTask(input, {
        source: formConfig.source,
        aiReason: formConfig.aiReason,
      });
      if (formConfig.resourceIds.length > 0) {
        setSavedResourceIds((prev) => {
          const next = new Set(prev);
          for (const id of formConfig.resourceIds) next.add(id);
          return next;
        });
      }
      toast.success("Task added from AI");
      return;
    }
```

Add `toggleResourceRead` to the `useTasks()` destructure (do NOT add `removeResource` yet — it has no consumer until Task 8 and would fail lint as unused).

Add `onToggleResourceRead={toggleResourceRead}` to `<TaskDetailsDialog />`.

Pass the new props to `<AiRecommendationsDialog />`:

```tsx
        resources={recResources}
        savedResourceIds={savedResourceIds}
```

- [ ] **Step 3: Verify types compile and the app builds**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. If lint flags `removeResource` as unused, remove it from the destructure and add it back in Task 8.

- [ ] **Step 4: Manually verify the two AI flows**

Run: `npm run dev`, open `http://localhost:3000`.
- Click `Plan a goal`, enter `vacuum the flat and take out the bins`, submit. Expected: inline red message under the textarea about learning goals; no form opens.
- Enter `Learn SQL basics over the next month`, submit. Expected: proposed-task form opens with subtasks and a `Reading list` section holding book entries with no links.
- Add three tasks, click `AI recommendations`. Expected: cards plus a `Recommended reading` section with all items checked.

- [ ] **Step 5: Commit**

```bash
git add components/ai-goal-dialog.tsx components/app-shell.tsx
git commit -m "feat: reject non-learning goals inline and carry reading into tasks"
```

---

### Task 8: Library tab

**Files:**
- Create: `components/library-tab.tsx`
- Modify: `components/app-shell.tsx`

**Interfaces:**
- Consumes: `ResourceList` from Task 5; `toggleResourceRead`, `removeResource` from Task 1.
- Produces: `LibraryTab` component with props `{ tasks, onToggleRead, onRemove, onOpenTask }`.

- [ ] **Step 1: Create the component**

Create `components/library-tab.tsx`:

```tsx
"use client";

import { Library } from "lucide-react";
import type { LearningResource, ResourceKind, Task } from "@/types";
import { ResourceList } from "@/components/resource-list";
import { EmptyState } from "@/components/empty-state";

const GROUPS: Array<{ kind: ResourceKind; label: string }> = [
  { kind: "book", label: "Books" },
  { kind: "course", label: "Courses" },
  { kind: "article", label: "Articles" },
];

interface LibraryEntry {
  resource: LearningResource;
  task: Task;
}

interface LibraryTabProps {
  tasks: Task[];
  onToggleRead: (taskId: string, resourceId: string) => void;
  onRemove: (taskId: string, resourceId: string) => void;
  onOpenTask: (task: Task) => void;
}

export function LibraryTab({
  tasks,
  onToggleRead,
  onRemove,
  onOpenTask,
}: LibraryTabProps) {
  const entries: LibraryEntry[] = tasks.flatMap((task) =>
    task.resources.map((resource) => ({ resource, task })),
  );

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Library className="size-8" />}
        title="Your reading list is empty."
        description="Reading that AI suggests for your study goals will collect here."
      />
    );
  }

  const taskByResourceId = new Map(
    entries.map((entry) => [entry.resource.id, entry.task]),
  );

  return (
    <div className="space-y-6">
      {GROUPS.map(({ kind, label }) => {
        const group = entries.filter((entry) => entry.resource.kind === kind);
        if (group.length === 0) return null;
        const readCount = group.filter((entry) => entry.resource.read).length;

        return (
          <div key={kind} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{label}</p>
              <span className="text-xs text-muted-foreground">
                {readCount}/{group.length} read
              </span>
            </div>
            <ResourceList
              resources={group.map((entry) => entry.resource)}
              onToggleRead={(resourceId) => {
                const task = taskByResourceId.get(resourceId);
                if (task) onToggleRead(task.id, resourceId);
              }}
              onRemove={(resourceId) => {
                const task = taskByResourceId.get(resourceId);
                if (task) onRemove(task.id, resourceId);
              }}
              renderSource={(resourceId) => {
                const task = taskByResourceId.get(resourceId);
                if (!task) return null;
                return (
                  <button
                    type="button"
                    onClick={() => onOpenTask(task)}
                    className="text-xs text-muted-foreground underline underline-offset-2"
                  >
                    From: {task.title}
                  </button>
                );
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Add the third tab**

In `components/app-shell.tsx`:

Add the import `import { LibraryTab } from "@/components/library-tab";` and add `removeResource` to the `useTasks()` destructure (Task 7 deliberately left it out).

Add above the return, next to `hasNoTasks`:

```tsx
  const resourceCount = tasks.reduce(
    (total, task) => total + task.resources.length,
    0,
  );
```

Change the tablist container class from `grid-cols-2` to `grid-cols-3`.

Add a third tab button, copying the exact markup of the existing two:

```tsx
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "library"}
          onClick={() => setActiveTab("library")}
          className={cn(
            "rounded-md px-3 py-1.5 transition-colors",
            activeTab === "library"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Library ({resourceCount})
        </button>
```

Restructure the content area so all three tabs are handled. Replace the whole `<div className="min-h-[55vh]"> … </div>` block with:

```tsx
      <div className="min-h-[55vh]">
        {activeTab === "library" ? (
          <LibraryTab
            tasks={tasks}
            onToggleRead={toggleResourceRead}
            onRemove={removeResource}
            onOpenTask={openDetails}
          />
        ) : activeTab === "active" ? (
          activeTasks.length === 0 ? (
            <EmptyState
              icon={<ListTodo className="size-8" />}
              title="Nothing in progress yet."
              description="Add a study task, or describe a learning goal and let AI build the plan."
              action={
                hasNoTasks ? (
                  <Button onClick={openCreate}>
                    <Plus />
                    Add your first study task
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <TaskList
              tasks={activeTasks}
              sortable
              onReorder={reorderActive}
              {...listHandlers}
            />
          )
        ) : doneTasks.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="size-8" />}
            title="Study tasks you finish will appear here."
          />
        ) : (
          <TaskList tasks={doneTasks} {...listHandlers} />
        )}
      </div>
```

This already applies the Task 9 empty-state copy — do not revert it there.

- [ ] **Step 3: Verify and manually check**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

Run `npm run dev` and:
- accept an AI recommendation with reading attached;
- open the `Library` tab — the resource appears under `Books` with `From: <task title>`;
- tick `read` — the group counter goes to `1/2`;
- reload the page — the tick survives;
- delete the resource — it disappears from both Library and the task's details.

- [ ] **Step 4: Commit**

```bash
git add components/library-tab.tsx components/app-shell.tsx
git commit -m "feat: add Library tab aggregating saved reading"
```

---

### Task 9: Copy pass

**Files:**
- Modify: `app/layout.tsx:6-10`
- Modify: `components/app-shell.tsx` (header, buttons)
- Modify: `components/task-form-dialog.tsx` (titles, labels, placeholders)
- Modify: `components/task-details-dialog.tsx` (`SOURCE_LABELS`)
- Modify: `components/ai-recommendations-dialog.tsx` (dialog copy)
- Modify: `components/ai-goal-dialog.tsx` (dialog copy)
- Modify: `components/category-select.tsx` (subject wording)
- Modify: `lib/validation.ts` (category error messages)
- Modify: `README.md`, `package.json`

**Interfaces:**
- Consumes: nothing new.
- Produces: no API changes — strings only.

- [ ] **Step 1: Metadata and package identity**

`app/layout.tsx`:

```tsx
export const metadata: Metadata = {
  title: "StudyPath — AI learning planner",
  description:
    "Plan what you learn: turn study goals into steps and get AI-suggested reading.",
};
```

`package.json`: change `"name": "project-next"` to `"name": "studypath-ai"`.

- [ ] **Step 2: App shell header and buttons**

In `components/app-shell.tsx`:

```tsx
          <h1 className="text-2xl font-semibold tracking-tight">
            My learning plan
          </h1>
          <p className="text-sm text-muted-foreground">
            Track what you are studying and let AI suggest next steps and
            reading.
          </p>
```

Change the create button label from `Add Task` to `Add study task`. Leave `AI recommendations` and `Plan a goal` unchanged.

Change the two existing tab labels: `Active ({activeTasks.length})` → `In progress ({activeTasks.length})`, `Done ({doneTasks.length})` → `Completed ({doneTasks.length})`.

Change the toast in `handleFormSubmit` for the manual branch from `"Task created"` to `"Study task created"`, and the edit branch from `"Task updated"` to `"Study task updated"`.

- [ ] **Step 3: Task form copy**

In `components/task-form-dialog.tsx`:

```ts
const TITLES: Record<TaskFormMode, string> = {
  create: "New study task",
  edit: "Edit study task",
  proposed: "Suggested study task",
};

const SUBMIT_LABELS: Record<TaskFormMode, string> = {
  create: "Create study task",
  edit: "Save changes",
  proposed: "Add to tasks",
};
```

Dialog description:

```tsx
          {mode === "proposed"
            ? "Review the plan and the reading list, then add it to your studies."
            : "Fill in the details for your study task."}
```

Field changes:
- title placeholder `"What needs to be done?"` → `"What do you want to learn?"`
- `<Label>Category</Label>` → `<Label>Subject</Label>`
- `<Label htmlFor="task-deadline">Deadline</Label>` → `<Label htmlFor="task-deadline">Target date</Label>`
- `<Label>Subtasks</Label>` → `<Label>Study steps</Label>`

- [ ] **Step 4: Subject wording in the category select**

In `components/category-select.tsx`: `"No category"` → `"No subject"` (three occurrences: the `SelectValue` placeholder, the fallback inside the render callback, and the `SelectItem`), `"Create new category"` → `"Create new subject"`, placeholder `"New category name"` → `"New subject name"`, `aria-label="Cancel new category"` → `aria-label="Cancel new subject"`.

In `lib/validation.ts`, `validateCategoryName`: `"Category name cannot be empty."` → `"Subject name cannot be empty."` and `` `Category name cannot exceed ${MAX_CATEGORY_LENGTH} characters.` `` → `` `Subject name cannot exceed ${MAX_CATEGORY_LENGTH} characters.` ``.

- [ ] **Step 5: Dialog copy**

`components/task-details-dialog.tsx`:

```ts
const SOURCE_LABELS: Record<TaskSource, string> = {
  manual: "Added manually",
  ai_recommendation: "From AI recommendation",
  ai_prompt: "From a learning goal",
};
```

`components/ai-recommendations-dialog.tsx`:

```tsx
          <DialogDescription>
            Next study steps based on what you are already learning. Review,
            edit, or dismiss each one.
          </DialogDescription>
```

```ts
const NOT_ENOUGH_HISTORY_MESSAGE =
  "Add or complete a few study tasks so we can suggest what to learn next.";
```

`components/ai-goal-dialog.tsx`:

```tsx
          <DialogTitle>Plan a learning goal</DialogTitle>
          <DialogDescription>
            Describe what you want to learn. AI will break it into steps and
            suggest reading.
          </DialogDescription>
```

- label `Your goal` → `Your learning goal`
- textarea placeholder → `"e.g. Learn React fundamentals over the next month"`
- button label `Generate task` → `Build the plan`, loading label `Generating...` → `Building...`

- [ ] **Step 6: Rewrite the README**

Replace `README.md` entirely:

````markdown
# StudyPath

An AI learning planner. You keep track of what you are studying; the app breaks
learning goals into steps and suggests literature for each of them.

## Features

- Manual study tasks with subject, target date and study steps
- **AI recommendations** — next study steps derived from your history, plus a
  recommended reading list
- **Plan a goal** — a free-text learning goal becomes a structured study task
  with steps and reading; non-learning goals are declined
- **Library** — every saved book, course and article in one place, with a read
  marker
- Drag-and-drop ordering, light/dark theme, data persisted in `localStorage`

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Environment

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `OPENAI_API_KEY` | no | — | Enables real AI responses. Without it the app falls back to a built-in mock provider, so every feature stays demonstrable offline. |
| `OPENAI_MODEL` | no | `gpt-4o-mini` | Model used for both AI features. |

Put them in `.env.local`.

## Suggested links

AI-produced URLs are sanitized server-side in `lib/ai/resources.ts`: books never
carry a link, and every other link must be `https` on a domain from an explicit
allowlist. Anything else keeps the title and drops the link.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, `@base-ui/react`,
OpenAI SDK, Vitest, Playwright.
````

- [ ] **Step 7: Grep for leftover old wording**

Run:

```bash
grep -rn "Todo AI\|My Tasks\|Add Task\|Create task\|No category\|Create new category\|New category name\|Category name cannot\|Proposed task\|Generate task\|project-next" \
  app components lib README.md package.json --include="*.ts" --include="*.tsx" --include="*.md" --include="*.json"
```

Expected: no matches. Any hit is a missed string — fix it.

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add app components lib README.md package.json
git commit -m "feat: reword the interface around learning instead of generic tasks"
```

---

### Task 10: Update the project specification

**Files:**
- Modify: `PROJECT_SPEC.md`

**Interfaces:**
- Consumes: the implemented behaviour from Tasks 1-9.
- Produces: documentation only.

- [ ] **Step 1: Retitle and rewrite section 1**

Change the document title to:

```
Технічне завдання на розробку веб-застосунку для планування навчання з AI-рекомендаціями
```

Rewrite section `1. Загальна концепція` so the bullet list reads:

```
Застосунок призначений для планування навчання та підтримки користувача під час опанування нових тем і навичок.

Основна ідея полягає в тому, що користувач:

* самостійно створює та керує навчальними задачами;
* позначає задачі як виконані;
* зберігає історію свого навчання;
* отримує від AI рекомендації щодо наступних навчальних кроків;
* може перетворити описану словами навчальну ціль на структуровану задачу;
* отримує разом із кожною AI-пропозицією добірку літератури — книг, курсів і статей;
* накопичує збережені джерела у власній бібліотеці;
* самостійно вирішує, чи додавати AI-рекомендацію до активного списку.

AI не повинен автоматично створювати або змінювати задачі без підтвердження користувача.
Не-навчальні цілі застосунок не обробляє.
```

- [ ] **Step 2: Add section 2.4**

After the existing `2.3. AI-рекомендація` subsection, insert:

```
2.4. Джерело для навчання

Кожне джерело повинно містити:

* унікальний ідентифікатор;
* тип — книга, курс або стаття;
* назву;
* автора;
* рік видання;
* посилання;
* коротке пояснення, чим джерело корисне;
* ознаку «опрацьовано».

Обов'язкові поля

* тип;
* назва;
* пояснення.

Обмеження щодо посилань

* книга ніколи не має посилання — вона ідентифікується автором, назвою і роком;
* посилання для курсу чи статті приймається лише за протоколом https і лише на домен зі списку дозволених;
* якщо посилання не проходить перевірку, джерело зберігається без посилання;
* максимальна кількість джерел в одній відповіді AI — п'ять.

Джерела зберігаються разом із задачею, до якої їх було додано.
```

- [ ] **Step 3: Extend sections 10 and 13**

In `10.4. Результат`, add:

```
Разом зі списком рекомендацій AI повертає від трьох до п'яти джерел для навчання за спільною темою історії користувача. Пріоритет надається книгам.
```

In `10.5. Відображення рекомендацій`, add:

```
Під списком карток відображається блок «Recommended reading». Кожне джерело має прапорець включення; відмічені джерела додаються до задачі, яку користувач прийме. Після додавання джерело позначається як збережене й більше не пропонується повторно.
```

In `13.1. Призначення`, add:

```
Функція обробляє лише навчальні цілі: вивчення теми, опанування навички чи мови, підготовку до іспиту, співбесіди чи сертифікації, читання за темою, навчальний проєкт заради практики.
```

In `13.3. Валідація`, add:

```
Якщо описана ціль не є навчальною, застосунок не створює задачу, а показує під полем введення повідомлення з прикладами навчальних цілей.
```

In `13.6. Результат`, add:

```
Разом із задачею у формі відображається блок «Reading list» із запропонованими джерелами. Будь-яке джерело можна прибрати перед додаванням задачі.
```

- [ ] **Step 4: Add section 16 and extend section 15**

Append after the last section:

```
16. Бібліотека джерел

16.1. Призначення

Бібліотека дає користувачу єдине місце, де зібрані всі збережені джерела, незалежно від того, до якої задачі вони належать.

16.2. Доступ

Бібліотека відкривається третьою вкладкою на головному екрані, поряд із «In progress» і «Completed». У заголовку вкладки відображається загальна кількість збережених джерел.

16.3. Вміст

Джерела групуються за типом у порядку: книги, курси, статті. Порожні групи не відображаються. Для кожної групи показується кількість опрацьованих джерел.

Кожен рядок містить назву (посилання, якщо воно є), тип, автора й рік, пояснення, назву задачі-джерела та прапорець «опрацьовано».

16.4. Дії

* перемикання ознаки «опрацьовано»;
* видалення джерела — воно зникає і з бібліотеки, і з задачі;
* перехід до задачі-джерела за кліком на її назву.

16.5. Порожній стан

Якщо жодного джерела не збережено, відображається пояснення, що сюди потраплятимуть джерела, запропоновані AI.
```

In section `15. Збереження даних`, add:

```
Разом із задачею зберігаються її джерела, включно з ознакою «опрацьовано». Активна вкладка зберігається й може приймати значення «активні», «виконані» або «бібліотека».
```

- [ ] **Step 5: Commit**

```bash
git add PROJECT_SPEC.md
git commit -m "docs: update the specification for the learning platform scope"
```

---

### Task 11: Update e2e tests and full verification

**Files:**
- Modify: `e2e/tasks.spec.ts`
- Modify: `e2e/ai.spec.ts`
- Modify: `e2e/iteration2.spec.ts`

**Interfaces:**
- Consumes: the full implemented app.
- Produces: a green suite.

- [ ] **Step 1: Update the changed labels across all three spec files**

Apply these exact replacements everywhere they appear in `e2e/`:

| Old | New |
|---|---|
| `"Add Task"` | `"Add study task"` |
| `"Create task"` | `"Create study task"` |
| `/Active \(` | `/In progress \(` |
| `/Done \(` | `/Completed \(` |
| `"Proposed task"` | `"Suggested study task"` |
| `"Generate task"` | `"Build the plan"` |
| `"Your goal"` | `"Your learning goal"` |
| `"Add or complete a few tasks"` | `"Add or complete a few study tasks"` |
| `"No category"` | `"No subject"` |
| `"Create new category"` | `"Create new subject"` |
| `getByLabel("Category")` | `getByLabel("Subject")` |
| `getByLabel("Deadline")` | `getByLabel("Target date")` |
| `"You have no active tasks yet."` | `"Nothing in progress yet."` |
| `"Create your first task"` | `"Add your first study task"` |
| `getByLabel("Subtasks")` | `getByLabel("Study steps")` — only the form field label. The `aria-label="Toggle subtasks"` on the task card and `"Add subtask"` button are unchanged; leave those assertions alone. |

Also make the seeded task titles learning-flavoured so the mock provider produces sensible output — in `e2e/ai.spec.ts` the three seeds are already `Learn React`, `Learn TypeScript`, `Build a Next.js app`; leave them.

In `e2e/ai.spec.ts`, the goal prompt `"Prepare for a full stack interview next month"` contains `prepare` and `interview`, so it passes the mock's learning check. Leave it.

- [ ] **Step 2: Run the e2e suite to see what still fails**

Run: `npm run test:e2e`
Expected: any remaining failure points at a string missed in Step 1. Fix each against the actual rendered text, then re-run until green.

- [ ] **Step 3: Add the new scenarios**

Append to `e2e/ai.spec.ts`:

```ts
test("declines a goal that is not about learning", async ({ page }) => {
  await page.getByRole("button", { name: "Plan a goal" }).click();
  await page
    .getByLabel("Your learning goal")
    .fill("vacuum the flat and take out the bins");
  await page.getByRole("button", { name: "Build the plan" }).click();

  await expect(
    page.getByText("This planner is for learning goals", { exact: false }),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("heading", { name: "Suggested study task" }),
  ).toBeHidden();
});

test("a learning goal comes back with a reading list", async ({ page }) => {
  await page.getByRole("button", { name: "Plan a goal" }).click();
  await page
    .getByLabel("Your learning goal")
    .fill("Learn SQL basics over the next month");
  await page.getByRole("button", { name: "Build the plan" }).click();

  await expect(
    page.getByRole("heading", { name: "Suggested study task" }),
  ).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Reading list")).toBeVisible();
});
```

Create the Library coverage as a new file `e2e/library.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

async function addLearningTaskWithReading(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Plan a goal" }).click();
  await page
    .getByLabel("Your learning goal")
    .fill("Learn SQL basics over the next month");
  await page.getByRole("button", { name: "Build the plan" }).click();
  await expect(
    page.getByRole("heading", { name: "Suggested study task" }),
  ).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Add to tasks" }).click();
}

test("saved reading shows up in the Library and survives a reload", async ({
  page,
}) => {
  await addLearningTaskWithReading(page);

  await page.getByRole("tab", { name: /Library \([1-9]/ }).click();
  await expect(page.getByText("Books")).toBeVisible();
  await expect(page.getByText("From:", { exact: false }).first()).toBeVisible();

  const firstReadCheckbox = page
    .getByRole("checkbox", { name: /Mark ".*" as read/ })
    .first();
  await firstReadCheckbox.check();
  await expect(page.getByText("1/", { exact: false }).first()).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: /Library \(/ }).click();
  await expect(
    page.getByRole("checkbox", { name: /Mark ".*" as read/ }).first(),
  ).toBeChecked();
});

test("removing a resource from the Library empties it", async ({ page }) => {
  await addLearningTaskWithReading(page);

  await page.getByRole("tab", { name: /Library \(/ }).click();

  const removeButtons = page.getByRole("button", { name: /Remove ".*"/ });
  const count = await removeButtons.count();
  for (let i = 0; i < count; i += 1) {
    await removeButtons.first().click();
  }

  await expect(page.getByText("Your reading list is empty.")).toBeVisible();
});
```

- [ ] **Step 4: Run the new scenarios**

Run: `npm run test:e2e`
Expected: PASS. If the Library tab count selector is flaky because the reading list length varies, assert on `/Library \(\d+\)/` instead of a digit range.

- [ ] **Step 5: Full verification**

Run each and confirm the output before claiming success:

```bash
npm run lint
npx tsc --noEmit
npm run test
npm run test:e2e
npm run build
```

Expected: all five pass. Paste the failing output rather than working around any that do not.

- [ ] **Step 6: Verify the real OpenAI path once**

With a valid `OPENAI_API_KEY` in `.env.local`, run `npm run dev` and exercise both AI features once. Expected: `strict: true` schema is accepted (no 400 from OpenAI about the schema), recommendations are learning-focused, the reading list contains books without links, and any course link points at an allowlisted domain. If OpenAI rejects the schema, the cause is a property missing from a `required` array — fix it in `lib/ai/openai.ts`.

- [ ] **Step 7: Commit**

```bash
git add e2e
git commit -m "test: cover the learning focus, off-topic refusal and Library"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| 3. Копірайт | 9 (plus empty states applied early in 8) |
| 4.1-4.2. Типи | 1 |
| 4.3. Міграція | 1 (Step 6) |
| 5. Санітизація + тести | 2 |
| 6.1-6.3. Рекомендації, промпт, схема, роут | 3, 4 |
| 6.4. Recommended reading UI | 6 |
| 7. Plan a goal + off-topic | 3, 4, 7 |
| 8.1-8.2. Reading list у формі й деталях | 5 |
| 8.3. ResourceList | 5 |
| 9. Library | 8 |
| 10. Mock-провайдер | 3 (Step 5) |
| 11. Оновлення ТЗ | 10 |
| 12. Тести | 1, 2, 11 |
| 14. Ризик `strict: true` | 11 (Step 6) |
| 15. Критерії готовності | 11 (Step 5) |

No gaps.

**Type consistency check:** `sanitizeResourceUrl` / `sanitizeResources` / `toLearningResources` / `MAX_RESOURCES` are defined in Task 2 and used with those exact names in Tasks 3 and 4. `TOGGLE_RESOURCE_READ` / `REMOVE_RESOURCE` are defined in Task 1 and dispatched by `toggleResourceRead` / `removeResource` there, consumed in Tasks 7-8. `ResourceList`'s prop names (`selectedIds`, `savedIds`, `onToggleSelect`, `onToggleRead`, `onRemove`, `renderSource`) match every call site in Tasks 5, 6 and 8. `onToggleResourceRead` is introduced on `TaskDetailsDialogProps` in Task 5 and passed in Task 7.

**Known cross-task dependency:** Tasks 3-6 each leave the tree temporarily uncompilable in downstream consumers; each task's verification step states exactly which files are expected to still error and where they get fixed. `npx tsc --noEmit` is clean again at the end of Task 7.
