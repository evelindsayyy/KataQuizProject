import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OpenTdbClient } from './services/opentdb.js';
import { QuizStore } from './services/quizStore.js';
import { LeaderboardRepo } from './db/leaderboard.js';
import { createQuizRouter } from './routes/quiz.js';
import { createLeaderboardRouter } from './routes/leaderboard.js';
import { createCategoriesRouter } from './routes/categories.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'leaderboard.db');

const app = express();

// Open CORS in dev (Vite is on a different port); drop in prod when the
// client bundle gets served from Express.
app.use(cors());
app.use(express.json());

// Explicit DI — makes swapping in a fake OpenTDB client in tests trivial.
const openTdb = new OpenTdbClient();
const store = new QuizStore();
const leaderboard = new LeaderboardRepo(DB_PATH);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/quiz', createQuizRouter({ openTdb, store, leaderboard }));
app.use('/api/leaderboard', createLeaderboardRouter(leaderboard));
app.use('/api/categories', createCategoriesRouter(openTdb));

// 4-arg signature = Express error handler.
app.use((
  err: Error,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
) => {
  console.error('[unhandled]', err);
  res.status(500).json({
    error: 'INTERNAL',
    message: 'Something went wrong on the server.',
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

// Close the DB handle on shutdown so WAL checkpoints flush.
const shutdown = () => {
  console.log('Shutting down...');
  leaderboard.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
