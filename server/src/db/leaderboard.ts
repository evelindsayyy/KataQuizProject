// Leaderboard repo. Prepared statements everywhere — never concatenate
// user input into SQL.

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Difficulty, LeaderboardEntry } from '@quiz-kata/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class LeaderboardRepo {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    const schema = fs.readFileSync(
      path.join(__dirname, 'schema.sql'),
      'utf-8',
    );
    this.db.exec(schema);
  }

  insert(entry: {
    playerName: string;
    score: number;
    total: number;
    category: string | null;
    difficulty: Difficulty | null;
  }): { id: number; rank: number } {
    const stmt = this.db.prepare(
      `INSERT INTO leaderboard (player_name, score, total, category, difficulty)
       VALUES (?, ?, ?, ?, ?)`,
    );
    const result = stmt.run(
      entry.playerName,
      entry.score,
      entry.total,
      entry.category,
      entry.difficulty,
    );
    const id = Number(result.lastInsertRowid);

    // Rank inside the same (category, difficulty) slice:
    // 1 + number of entries with strictly higher percentage.
    // IS handles NULL-to-NULL, = handles non-NULL, so one query covers both.
    const rankStmt = this.db.prepare(
      `SELECT COUNT(*) + 1 AS rank
       FROM leaderboard
       WHERE (category IS ? OR category = ?)
         AND (difficulty IS ? OR difficulty = ?)
         AND (score * 1.0 / total) > (? * 1.0 / ?)`,
    );
    const row = rankStmt.get(
      entry.category, entry.category,
      entry.difficulty, entry.difficulty,
      entry.score, entry.total,
    ) as { rank: number };

    return { id, rank: row.rank };
  }

  top(opts: {
    limit: number;
    category?: string | null;
    difficulty?: Difficulty | null;
  }): LeaderboardEntry[] {
    // Dynamic WHERE — still parameterised.
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (opts.category !== undefined) {
      if (opts.category === null) {
        conditions.push('category IS NULL');
      } else {
        conditions.push('category = ?');
        params.push(opts.category);
      }
    }
    if (opts.difficulty !== undefined) {
      if (opts.difficulty === null) {
        conditions.push('difficulty IS NULL');
      } else {
        conditions.push('difficulty = ?');
        params.push(opts.difficulty);
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(opts.limit);

    const rows = this.db.prepare(
      `SELECT
         id, player_name, score, total,
         ROUND(score * 100.0 / total, 1) AS percentage,
         category, difficulty, created_at
       FROM leaderboard
       ${where}
       ORDER BY (score * 1.0 / total) DESC, score DESC, created_at ASC
       LIMIT ?`
    ).all(...params) as Array<{
      id: number;
      player_name: string;
      score: number;
      total: number;
      percentage: number;
      category: string | null;
      difficulty: Difficulty | null;
      created_at: string;
    }>;

    return rows.map(r => ({
      id: r.id,
      playerName: r.player_name,
      score: r.score,
      total: r.total,
      percentage: r.percentage,
      category: r.category,
      difficulty: r.difficulty,
      createdAt: r.created_at,
    }));
  }

  close(): void {
    this.db.close();
  }
}
