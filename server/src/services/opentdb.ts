// OpenTDB client.
// Quirks: response codes 0-5 arrive over HTTP 200; encode=base64 encodes
// every string field (including enum-shaped ones); 1 req / 5s / IP.
// Docs: https://opentdb.com/api_config.php

import type { Category, Difficulty, QuestionType } from '@quiz-kata/shared';

const BASE = 'https://opentdb.com';

export class OpenTdbError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = 'OpenTdbError';
  }
}

interface RawQuestion {
  category: string;
  type: QuestionType;
  difficulty: Difficulty;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

export interface DecodedQuestion {
  category: string;
  type: QuestionType;
  difficulty: Difficulty;
  question: string;
  correctAnswer: string;
  incorrectAnswers: string[];
}

interface QuestionResponse {
  response_code: number;
  results: RawQuestion[];
}

interface TokenResponse {
  response_code: number;
  token: string;
}

interface CategoryResponse {
  trivia_categories: Category[];
}

const b64decode = (s: string): string =>
  Buffer.from(s, 'base64').toString('utf-8');

// encode=base64 encodes everything, including type/difficulty.
const decodeQuestion = (q: RawQuestion): DecodedQuestion => ({
  category: b64decode(q.category),
  type: b64decode(q.type) as QuestionType,
  difficulty: b64decode(q.difficulty) as Difficulty,
  question: b64decode(q.question),
  correctAnswer: b64decode(q.correct_answer),
  incorrectAnswers: q.incorrect_answers.map(b64decode),
});

const checkResponseCode = (code: number): void => {
  switch (code) {
    case 0:
      return; // success
    case 1:
      throw new OpenTdbError(
        1,
        'OpenTDB does not have enough questions for that query. Try a different category or fewer questions.',
      );
    case 2:
      throw new OpenTdbError(2, 'Invalid parameters sent to OpenTDB.');
    case 3:
      throw new OpenTdbError(3, 'OpenTDB session token not found.');
    case 4:
      throw new OpenTdbError(
        4,
        'OpenTDB session token has returned all available questions. Reset required.',
      );
    case 5:
      throw new OpenTdbError(
        5,
        'OpenTDB rate limit hit (max 1 request per 5 seconds). Please try again shortly.',
      );
    default:
      throw new OpenTdbError(code, `Unknown OpenTDB response code: ${code}`);
  }
};

export class OpenTdbClient {
  private sessionToken: string | null = null;
  // Categories are static — cache once per process.
  private categoriesCache: Category[] | null = null;

  private async ensureToken(): Promise<string> {
    if (this.sessionToken) return this.sessionToken;
    const res = await fetch(`${BASE}/api_token.php?command=request`);
    if (!res.ok) throw new Error(`Token request failed: HTTP ${res.status}`);
    const data = (await res.json()) as TokenResponse;
    checkResponseCode(data.response_code);
    this.sessionToken = data.token;
    return data.token;
  }

  private async resetToken(): Promise<string> {
    if (!this.sessionToken) return this.ensureToken();
    const res = await fetch(
      `${BASE}/api_token.php?command=reset&token=${this.sessionToken}`,
    );
    if (!res.ok) throw new Error(`Token reset failed: HTTP ${res.status}`);
    const data = (await res.json()) as TokenResponse;
    checkResponseCode(data.response_code);
    return this.sessionToken;
  }

  async fetchQuestions(opts: {
    amount: number;
    category?: number;
    difficulty?: Difficulty;
  }): Promise<DecodedQuestion[]> {
    const token = await this.ensureToken();
    const params = new URLSearchParams({
      amount: String(opts.amount),
      encode: 'base64',
      token,
    });
    if (opts.category !== undefined) params.set('category', String(opts.category));
    if (opts.difficulty) params.set('difficulty', opts.difficulty);

    const url = `${BASE}/api.php?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OpenTDB HTTP ${res.status}`);
    const data = (await res.json()) as QuestionResponse;

    // Token exhausted — reset and retry once.
    if (data.response_code === 4) {
      await this.resetToken();
      return this.fetchQuestions(opts);
    }

    checkResponseCode(data.response_code);
    return data.results.map(decodeQuestion);
  }

  async fetchCategories(): Promise<Category[]> {
    if (this.categoriesCache) return this.categoriesCache;
    const res = await fetch(`${BASE}/api_category.php`);
    if (!res.ok) throw new Error(`OpenTDB HTTP ${res.status}`);
    const data = (await res.json()) as CategoryResponse;
    this.categoriesCache = data.trivia_categories;
    return this.categoriesCache;
  }
}
