import type {
  AiRecommendationDTO,
  AiResourceDTO,
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
  { category: "Programming", words: ["code", "programming", "javascript", "typescript", "python", "react", "algorithm", "database", "sql"] },
  { category: "Languages", words: ["language", "english", "german", "spanish", "vocabulary", "grammar", "ielts", "toefl"] },
  { category: "Mathematics", words: ["math", "algebra", "calculus", "statistics", "probability", "linear"] },
  { category: "Design", words: ["design", "ux", "ui", "typography", "figma"] },
  { category: "Business", words: ["business", "management", "marketing", "finance", "economics"] },
];

export function guessCategory(text: string): string | null {
  for (const { category, words } of CATEGORY_KEYWORDS) {
    if (words.some((w) => new RegExp(`\\b${w}\\b`, "i").test(text))) {
      return category;
    }
  }
  return null;
}

const LEARNING_KEYWORDS = [
  "learn", "study", "master", "course", "exam", "practice", "practise",
  "understand", "tutorial", "skill", "language", "certification",
  "revise", "basics", "fundamentals", "training", "lecture", "research",
];

const LEARNING_RE = new RegExp(`\\b(${LEARNING_KEYWORDS.join("|")})`, "i");
const PREPARE_RE = /\bprepare\s+(for|to)\b/i;
const CHORE_RE = /\b(buy|clean|vacuum|cook|call|pay|fix|order|book a)\b/i;

function isLearningGoal(text: string): boolean {
  if (LEARNING_RE.test(text) || PREPARE_RE.test(text)) return true;
  if (CHORE_RE.test(text)) return false;
  return guessCategory(text) !== null;
}

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

function mockResources(category: string | null): AiResourceDTO[] {
  return category ? RESOURCES_BY_CATEGORY[category] ?? GENERIC_RESOURCES : GENERIC_RESOURCES;
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
  return [
    "Map out what the topic covers",
    "Pick one primary source to work through",
    "Study in focused sessions",
    "Test yourself without notes",
    "Note what still feels unclear",
  ];
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
): { recommendations: AiRecommendationDTO[]; resources: AiResourceDTO[] } {
  const { activeTasks, completedTasks } = body;
  const all = [...completedTasks, ...activeTasks];
  const topCategory = pickCategory(all);
  const lastCompleted = completedTasks[completedTasks.length - 1];
  const firstActive = activeTasks[0];

  const recs: Array<Omit<AiRecommendationDTO, "subtasks">> = [];

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

  return {
    recommendations: recs
      .slice(0, 5)
      .map((rec) => ({ ...rec, subtasks: decompose(rec.title) })),
    resources: mockResources(topCategory),
  };
}

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
