// sessionStorage-backed active quiz so refresh doesn't lose progress.
// Tab close still loses the session — acceptable for a short-lived round.

import type { ClientQuestion } from '@quiz-kata/shared';

const SESSION_KEY = 'quiz-kata:active-quiz';
const NAME_KEY = 'quiz-kata:player-name';

export interface ActiveQuiz {
  quizId: string;
  questions: ClientQuestion[];
  /** question id -> selected option */
  answers: Record<string, string>;
}

export function saveActiveQuiz(quiz: ActiveQuiz): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(quiz));
  } catch {
    // Safari private mode can throw — quiz still works, just not refresh-safe.
  }
}

export function loadActiveQuiz(quizId: string): ActiveQuiz | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveQuiz;
    // Only return if the URL quizId matches — stops stale state bleeding in.
    if (parsed.quizId !== quizId) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Returns any stored quiz, no ID match required. Home uses this for the
// "Resume" entry point.
export function peekActiveQuiz(): ActiveQuiz | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveQuiz;
    if (!parsed.quizId || !Array.isArray(parsed.questions)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearActiveQuiz(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export function loadPlayerName(): string {
  try {
    return sessionStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function savePlayerName(name: string): void {
  try {
    sessionStorage.setItem(NAME_KEY, name);
  } catch {
    // ignore
  }
}
