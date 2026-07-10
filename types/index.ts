export type TaskStatus = "active" | "done";

export type TaskSource = "manual" | "ai_recommendation" | "ai_prompt";

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
  type: RecommendationType;
}

export interface AiRecommendationsResponse {
  recommendations: AiRecommendationDTO[];
}

export interface AiParseResponse {
  recommendation: AiRecommendationDTO;
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

export type ActiveTab = "active" | "done";

export interface PersistedState {
  tasks: Task[];
  categories: Category[];
  activeTab: ActiveTab;
}
