// Typed fetch wrapper around our backend. Return types come from
// @quiz-kata/shared so backend contract changes surface at compile time.

import type {
  ApiError,
  CategoriesResponse,
  LeaderboardResponse,
  QuizStartRequest,
  QuizStartResponse,
  QuizSubmitRequest,
  QuizSubmitResponse,
  Difficulty,
} from '@quiz-kata/shared';

// Throws ApiRequestError on non-2xx with the typed body attached.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    // Backend returns ApiError shape on non-2xx; fall back if it doesn't.
    let body: ApiError;
    try {
      body = (await res.json()) as ApiError;
    } catch {
      body = {
        error: 'UNKNOWN',
        message: `HTTP ${res.status} ${res.statusText}`,
      };
    }
    throw new ApiRequestError(res.status, body);
  }
  return (await res.json()) as T;
}

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError,
  ) {
    super(body.message);
    this.name = 'ApiRequestError';
  }
}

export const api = {
  startQuiz: (body: QuizStartRequest) =>
    request<QuizStartResponse>('/api/quiz/start', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  submitQuiz: (quizId: string, body: QuizSubmitRequest) =>
    request<QuizSubmitResponse>(`/api/quiz/${quizId}/submit`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  leaderboard: (params?: {
    limit?: number;
    category?: string;
    difficulty?: Difficulty;
  }) => {
    const qs = new URLSearchParams();
    if (params?.limit !== undefined) qs.set('limit', String(params.limit));
    if (params?.category) qs.set('category', params.category);
    if (params?.difficulty) qs.set('difficulty', params.difficulty);
    const suffix = qs.toString() ? `?${qs}` : '';
    return request<LeaderboardResponse>(`/api/leaderboard${suffix}`);
  },

  categories: () => request<CategoriesResponse>('/api/categories'),
};
