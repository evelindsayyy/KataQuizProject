import { Router } from 'express';
import type {
  Difficulty,
  QuizStartRequest,
  QuizStartResponse,
  QuizSubmitRequest,
  QuizSubmitResponse,
  QuestionResult,
} from '@quiz-kata/shared';
import { OpenTdbClient, OpenTdbError } from '../services/opentdb.js';
import { QuizStore } from '../services/quizStore.js';
import { LeaderboardRepo } from '../db/leaderboard.js';

const openTdbStatus = (code: number): number => {
  if (code === 1 || code === 2) return 400;
  if (code === 5) return 429;
  return 502;
};

const VALID_DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

// Inline validation — three fields, three checks. Zod when it grows.
interface ValidationError {
  error: string;
  message: string;
}
const parseStartBody = (
  body: Partial<QuizStartRequest>,
): { ok: true; value: QuizStartRequest } | { ok: false; err: ValidationError } => {
  if (
    typeof body.amount !== 'number' ||
    !Number.isInteger(body.amount) ||
    body.amount < 1 ||
    body.amount > 50
  ) {
    return {
      ok: false,
      err: { error: 'INVALID_AMOUNT', message: 'amount must be an integer between 1 and 50' },
    };
  }
  if (body.category !== undefined) {
    if (
      typeof body.category !== 'number' ||
      !Number.isInteger(body.category) ||
      body.category < 1
    ) {
      return {
        ok: false,
        err: { error: 'INVALID_CATEGORY', message: 'category must be a positive integer' },
      };
    }
  }
  if (body.difficulty !== undefined) {
    if (!VALID_DIFFICULTIES.includes(body.difficulty)) {
      return {
        ok: false,
        err: {
          error: 'INVALID_DIFFICULTY',
          message: `difficulty must be one of: ${VALID_DIFFICULTIES.join(', ')}`,
        },
      };
    }
  }
  return {
    ok: true,
    value: {
      amount: body.amount,
      category: body.category,
      difficulty: body.difficulty,
    },
  };
};

export function createQuizRouter(deps: {
  openTdb: OpenTdbClient;
  store: QuizStore;
  leaderboard: LeaderboardRepo;
}): Router {
  const router = Router();

  // POST /api/quiz/start
  router.post('/start', async (req, res, next) => {
    try {
      const parsed = parseStartBody(req.body as Partial<QuizStartRequest>);
      if (!parsed.ok) {
        return res.status(400).json(parsed.err);
      }
      const { amount, category, difficulty } = parsed.value;

      const raw = await deps.openTdb.fetchQuestions({ amount, category, difficulty });

      // Pull category name off the first result so the stored quiz can
      // tag the eventual leaderboard entry correctly.
      const categoryName = raw[0]?.category ?? null;

      const { quizId, clientQuestions } = deps.store.createQuiz(raw, {
        category: categoryName ?? undefined,
        difficulty,
      });

      const response: QuizStartResponse = { quizId, questions: clientQuestions };
      return res.json(response);
    } catch (err) {
      if (err instanceof OpenTdbError) {
        return res.status(openTdbStatus(err.code)).json({
          error: `OPENTDB_${err.code}`,
          message: err.message,
        });
      }
      return next(err);
    }
  });

  // POST /api/quiz/:quizId/submit
  router.post('/:quizId/submit', (req, res) => {
    const { quizId } = req.params;
    const quiz = deps.store.get(quizId);
    if (!quiz) {
      return res.status(404).json({
        error: 'QUIZ_NOT_FOUND',
        message: 'Quiz not found or has expired.',
      });
    }

    const body = req.body as Partial<QuizSubmitRequest>;
    if (!Array.isArray(body.answers) || typeof body.playerName !== 'string') {
      return res.status(400).json({
        error: 'INVALID_BODY',
        message: 'answers[] and playerName are required',
      });
    }

    const trimmedName = body.playerName.trim().slice(0, 40);
    if (trimmedName.length === 0) {
      return res.status(400).json({
        error: 'INVALID_NAME',
        message: 'playerName cannot be empty',
      });
    }

    // Iterate stored questions, NOT the submitted payload. A client that
    // omits answers gets them wrong, not silently skipped.
    const results: QuestionResult[] = [];
    let score = 0;
    for (const [questionId, stored] of quiz.questions) {
      const submitted = body.answers.find(a => a.questionId === questionId);
      const submittedAnswer = submitted?.answer ?? '';
      const isCorrect = submittedAnswer === stored.correctAnswer;
      if (isCorrect) score += 1;
      results.push({
        questionId,
        submittedAnswer,
        correctAnswer: stored.correctAnswer,
        isCorrect,
      });
    }

    const total = quiz.questions.size;
    const { rank } = deps.leaderboard.insert({
      playerName: trimmedName,
      score,
      total,
      category: quiz.category,
      difficulty: quiz.difficulty,
    });

    deps.store.delete(quizId);

    const response: QuizSubmitResponse = {
      score,
      total,
      results,
      leaderboardRank: rank,
    };
    return res.json(response);
  });

  return router;
}
