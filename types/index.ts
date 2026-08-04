export type TaskStatus = "active" | "done";

export type TaskSource = "manual" | "ai_recommendation" | "ai_prompt";

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export type ResourceKind = "book" | "article" | "course";

export interface ResourceTakeaways {
  points: string[];
  fit: string;
}

export interface LearningResource {
  id: string;
  kind: ResourceKind;
  title: string;
  author?: string;
  year?: number;
  url?: string;
  note: string;
  takeaways?: ResourceTakeaways;
  read: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  categoryId?: string;
  deadline?: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  source: TaskSource;
  aiReason?: string;
  subtasks: Subtask[];
  resources: LearningResource[];
  order: number;
  edited: boolean;
}

export interface Category {
  id: string;
  name: string;
  createdAt: string;
}

export type RecommendationType = "history_based" | "prompt_based";

export type RecommendationStatus = "new" | "accepted" | "rejected";

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  categoryName?: string;
  deadline: string | null;
  reason: string;
  type: RecommendationType;
  status: RecommendationStatus;
}

export interface AiRecommendationDTO {
  title: string;
  description: string;
  category: string | null;
  deadline: string | null;
  reason: string;
  subtasks: string[];
  type: RecommendationType;
}

export interface AiResourceDTO {
  kind: ResourceKind;
  title: string;
  author: string | null;
  year: number | null;
  url: string | null;
  note: string;
  takeaways: ResourceTakeaways | null;
}

export interface AiRecommendationsResponse {
  recommendations: AiRecommendationDTO[];
  resources: AiResourceDTO[];
}

export interface AiParseResponse {
  recommendation: AiRecommendationDTO;
  resources: AiResourceDTO[];
}

export interface TaskSnapshot {
  title: string;
  description?: string;
  category?: string;
  deadline?: string;
  completedAt?: string;
}

export interface RecommendationsRequestBody {
  activeTasks: TaskSnapshot[];
  completedTasks: TaskSnapshot[];
}

export interface ParseIntentRequestBody {
  text: string;
}

export type ActiveTab = "active" | "done" | "library";

export interface PersistedState {
  tasks: Task[];
  categories: Category[];
  activeTab: ActiveTab;
}
