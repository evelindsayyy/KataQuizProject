// GET /api/categories — thin proxy around OpenTDB's category list.
// Cached in OpenTdbClient; client never sees OpenTDB directly.

import { Router } from 'express';
import type { CategoriesResponse } from '@quiz-kata/shared';
import { OpenTdbClient } from '../services/opentdb.js';

export function createCategoriesRouter(openTdb: OpenTdbClient): Router {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const categories = await openTdb.fetchCategories();
      const response: CategoriesResponse = { categories };
      return res.json(response);
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
