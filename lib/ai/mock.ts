import type {
  AiRecommendationDTO,
  RecommendationsRequestBody,
  TaskSnapshot,
} from "@/types";
import { todayISODate } from "@/lib/sort";

function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return todayISODate(date);
}

const CATEGORY_KEYWORDS: Array<{ category: string; words: string[] }> = [
  { category: "Learning", words: ["learn", "study", "course", "read", "practice", "interview"] },
  { category: "Work", words: ["work", "project", "client", "report", "meeting", "deploy", "ship"] },
  { category: "Health", words: ["gym", "run", "workout", "health", "doctor", "sleep", "meditate"] },
  { category: "Finance", words: ["budget", "money", "invoice", "tax", "save", "invest"] },
  { category: "Errands", words: ["buy", "clean", "fix", "call", "grocery", "laundry", "repair"] },
];

function guessCategory(text: string): string | null {
  const lower = text.toLowerCase();
  for (const { category, words } of CATEGORY_KEYWORDS) {
    if (words.some((w) => lower.includes(w))) return category;
  }
  return null;
}

function decompose(text: string): string[] {
  const lower = text.toLowerCase();
  if (/\b(learn|study|master)\b/.test(lower)) {
    return [
      "Find quality learning resources",
      "Cover the core concepts",
      "Practice with small exercises",
      "Build a small hands-on project",
      "Review and fill the gaps",
    ];
  }
  if (/\b(prepare|interview)\b/.test(lower)) {
    return [
      "List the topics to cover",
      "Gather study materials",
      "Practice a little every day",
      "Do a mock run",
      "Review the weak areas",
    ];
  }
  if (/\b(plan|organize|organise)\b/.test(lower)) {
    return [
      "Define the goal clearly",
      "List the concrete steps",
      "Set a few milestones",
      "Schedule time for each step",
    ];
  }
  if (/\b(build|create|develop|ship)\b/.test(lower)) {
    return [
      "Outline the requirements",
      "Set up the project",
      "Implement the core parts",
      "Test the result",
      "Polish and finish",
    ];
  }
  return [];
}

function pickCategory(snapshots: TaskSnapshot[]): string | null {
  const counts = new Map<string, number>();
  for (const snap of snapshots) {
    if (snap.category) {
      counts.set(snap.category, (counts.get(snap.category) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [category, count] of counts) {
    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  }
  return best;
}

export function generateRecommendations(
  body: RecommendationsRequestBody,
): AiRecommendationDTO[] {
  const { activeTasks, completedTasks } = body;
  const all = [...completedTasks, ...activeTasks];
  const topCategory = pickCategory(all);
  const lastCompleted = completedTasks[completedTasks.length - 1];
  const firstActive = activeTasks[0];

  const recs: Array<Omit<AiRecommendationDTO, "subtasks">> = [];

  if (lastCompleted) {
    recs.push({
      title: `Build on "${lastCompleted.title}"`,
      description: `Take the next step after completing "${lastCompleted.title}". Define a concrete follow-up that deepens what you already achieved.`,
      category: lastCompleted.category ?? topCategory,
      deadline: addDays(7),
      reason: `You recently completed "${lastCompleted.title}", so a natural next step keeps your momentum going.`,
      type: "history_based",
    });
  }

  if (topCategory) {
    recs.push({
      title: `Plan your next ${topCategory.toLowerCase()} goal`,
      description: `Most of your tasks fall under ${topCategory}. Outline one focused goal to make measurable progress there.`,
      category: topCategory,
      deadline: addDays(14),
      reason: `${topCategory} is your most frequent category, so a dedicated goal aligns with your current focus.`,
      type: "history_based",
    });
  }

  if (firstActive) {
    recs.push({
      title: `Break down "${firstActive.title}"`,
      description: `Split "${firstActive.title}" into 2-3 smaller, actionable steps so it is easier to finish.`,
      category: firstActive.category ?? topCategory,
      deadline: null,
      reason: `"${firstActive.title}" is still active; breaking it into smaller steps makes it more approachable.`,
      type: "history_based",
    });
  }

  recs.push({
    title: "Review and organize your task list",
    description:
      "Spend 15 minutes reviewing your active tasks, updating deadlines, and removing anything no longer relevant.",
    category: topCategory,
    deadline: addDays(2),
    reason:
      "A regular review keeps your list accurate and helps you prioritize what matters next.",
    type: "history_based",
  });

  recs.push({
    title: "Schedule time for a personal goal",
    description:
      "Reserve a block of time this week for something you have been meaning to start but keep postponing.",
    category: null,
    deadline: addDays(5),
    reason:
      "Balancing planned tasks with a personal goal helps maintain motivation over time.",
    type: "history_based",
  });

  return recs
    .slice(0, 5)
    .map((rec) => ({ ...rec, subtasks: decompose(rec.title) }));
}

export function parseIntent(text: string): AiRecommendationDTO {
  const trimmed = text.trim();
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

  return {
    title,
    description: `Turn your goal into an actionable plan: ${trimmed}`,
    category: guessCategory(trimmed),
    deadline,
    reason:
      "This task captures the intent you described and gives you a concrete starting point you can refine.",
    subtasks: decompose(trimmed),
    type: "prompt_based",
  };
}
