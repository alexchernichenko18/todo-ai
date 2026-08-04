import type {
  AiResourceDTO,
  LearningResource,
  ResourceKind,
  ResourceTakeaways,
} from "@/types";
import { newId } from "@/lib/id";

export const MAX_RESOURCES = 5;

export const MAX_TAKEAWAY_POINTS = 6;

const MIN_TAKEAWAY_POINTS = 2;

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
  parsed.username = "";
  parsed.password = "";
  return parsed.toString();
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
      takeaways: sanitizeTakeaways(candidate.takeaways),
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
    takeaways: dto.takeaways ?? undefined,
    read: false,
  }));
}
