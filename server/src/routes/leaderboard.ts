import { Router } from 'express';
import type { Difficulty, LeaderboardResponse } from '@quiz-kata/shared';
import { LeaderboardRepo } from '../db/leaderboard.js';

const VALID_DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export function createLeaderboardRouter(
  leaderboard: LeaderboardRepo,
): Router {
  const router = Router();

  // GET /api/leaderboard?limit=10&category=...&difficulty=easy
  router.get('/', (req, res) => {
    const limitRaw = req.query.limit;
    const limit = typeof limitRaw === 'string' ? parseInt(limitRaw, 10) : 10;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({
        error: 'INVALID_LIMIT',
        message: 'limit must be an integer between 1 and 100',
      });
    }

    const category =
      typeof req.query.category === 'string' ? req.query.category : undefined;
    const difficultyRaw = req.query.difficulty;
    let difficulty: Difficulty | undefined;
    if (typeof difficultyRaw === 'string') {
      if (!VALID_DIFFICULTIES.includes(difficultyRaw as Difficulty)) {
        return res.status(400).json({
          error: 'INVALID_DIFFICULTY',
          message: `difficulty must be one of: ${VALID_DIFFICULTIES.join(', ')}`,
        });
      }
      difficulty = difficultyRaw as Difficulty;
    }

    const entries = leaderboard.top({ limit, category, difficulty });
    const response: LeaderboardResponse = { entries };
    return res.json(response);
  });

  return router;
}
