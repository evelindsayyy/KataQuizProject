// Shared types — the API contract between client and server.
// Note: ClientQuestion intentionally has no `correctAnswer`. Answers
// stay server-side until the user submits.

export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuestionType = 'multiple' | 'boolean';

export interface Category {
  id: number;
  name: string;
}

export interface CategoriesResponse {
  categories: Category[];
}

/** What the client sees. Options are pre-shuffled server-side. */
export interface ClientQuestion {
  id: string;
  category: string;
  difficulty: Difficulty;
  type: QuestionType;
  question: string;
  options: string[];
}

export interface QuizStartRequest {
  amount: number;
  category?: number;
  difficulty?: Difficulty;
}

export interface QuizStartResponse {
  quizId: string;
  questions: ClientQuestion[];
}

export interface SubmittedAnswer {
  questionId: string;
  answer: string;
}

export interface QuizSubmitRequest {
  answers: SubmittedAnswer[];
  playerName: string;
}

export interface QuestionResult {
  questionId: string;
  submittedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export interface QuizSubmitResponse {
  score: number;
  total: number;
  results: QuestionResult[];
  leaderboardRank?: number;
}

export interface LeaderboardEntry {
  id: number;
  playerName: string;
  score: number;
  total: number;
  percentage: number;
  category: string | null;
  difficulty: Difficulty | null;
  createdAt: string;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
}

/** Error envelope for every non-2xx response. */
export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}
