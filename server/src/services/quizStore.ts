// In-memory store for active quizzes. Answers live here until the user
// submits — never shipped to the client. Short-lived, so not persisted.
// Single-process only; Redis would be the scale-out swap.

import crypto from 'node:crypto';
import type { ClientQuestion, Difficulty } from '@quiz-kata/shared';
import type { DecodedQuestion } from './opentdb.js';

export interface StoredQuiz {
  quizId: string;
  createdAt: number;
  category: string | null;
  difficulty: Difficulty | null;
  questions: Map<
    string,
    {
      correctAnswer: string;
      options: string[];
      category: string;
      difficulty: Difficulty;
      type: 'multiple' | 'boolean';
      question: string;
    }
  >;
}

// Fisher-Yates.
const shuffle = <T,>(arr: readonly T[]): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
};

export class QuizStore {
  private quizzes = new Map<string, StoredQuiz>();
  private readonly TTL_MS = 1000 * 60 * 60; // reap after 1h

  createQuiz(
    raw: DecodedQuestion[],
    opts: { category?: string; difficulty?: Difficulty },
  ): { quizId: string; clientQuestions: ClientQuestion[] } {
    this.reapStale();

    const quizId = crypto.randomUUID();
    const questions = new Map<string, StoredQuiz['questions'] extends Map<string, infer V> ? V : never>();
    const clientQuestions: ClientQuestion[] = [];

    for (const q of raw) {
      const questionId = crypto.randomUUID();
      const allOptions = shuffle([q.correctAnswer, ...q.incorrectAnswers]);
      questions.set(questionId, {
        correctAnswer: q.correctAnswer,
        options: allOptions,
        category: q.category,
        difficulty: q.difficulty,
        type: q.type,
        question: q.question,
      });
      clientQuestions.push({
        id: questionId,
        category: q.category,
        difficulty: q.difficulty,
        type: q.type,
        question: q.question,
        options: allOptions,
      });
    }

    this.quizzes.set(quizId, {
      quizId,
      createdAt: Date.now(),
      category: opts.category ?? null,
      difficulty: opts.difficulty ?? null,
      questions,
    });

    return { quizId, clientQuestions };
  }

  get(quizId: string): StoredQuiz | undefined {
    return this.quizzes.get(quizId);
  }

  delete(quizId: string): void {
    this.quizzes.delete(quizId);
  }

  private reapStale(): void {
    const cutoff = Date.now() - this.TTL_MS;
    for (const [id, quiz] of this.quizzes) {
      if (quiz.createdAt < cutoff) this.quizzes.delete(id);
    }
  }
}
