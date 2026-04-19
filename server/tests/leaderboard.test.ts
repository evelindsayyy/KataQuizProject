// Rank-on-insert SQL is the sneakiest bit of the server — a NULL- or
// tie-handling bug silently hands people the wrong rank.
// Each test gets a fresh :memory: DB.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LeaderboardRepo } from '../src/db/leaderboard.js';

describe('LeaderboardRepo', () => {
  let repo: LeaderboardRepo;

  beforeEach(() => {
    repo = new LeaderboardRepo(':memory:');
  });
  afterEach(() => {
    repo.close();
  });

  it('returns rank 1 for the first score in an empty board', () => {
    const { rank } = repo.insert({
      playerName: 'Alice',
      score: 7,
      total: 10,
      category: null,
      difficulty: null,
    });
    expect(rank).toBe(1);
  });

  it('ranks by percentage, not raw score', () => {
    // Alice 80%, Bob 100% → Bob wins.
    repo.insert({ playerName: 'Alice', score: 8, total: 10, category: null, difficulty: null });
    const bob = repo.insert({ playerName: 'Bob', score: 5, total: 5, category: null, difficulty: null });
    expect(bob.rank).toBe(1);

    const top = repo.top({ limit: 10 });
    expect(top[0]?.playerName).toBe('Bob');
    expect(top[1]?.playerName).toBe('Alice');
  });

  it('computes rank only against entries in the same slice', () => {
    // Hard 100% shouldn't affect the easy leaderboard.
    repo.insert({ playerName: 'Alice', score: 6, total: 10, category: null, difficulty: 'easy' });
    repo.insert({ playerName: 'Bob', score: 10, total: 10, category: null, difficulty: 'hard' });
    const carol = repo.insert({
      playerName: 'Carol',
      score: 9,
      total: 10,
      category: null,
      difficulty: 'easy',
    });
    expect(carol.rank).toBe(1);
  });

  it('filters top() by category and difficulty', () => {
    repo.insert({ playerName: 'A', score: 10, total: 10, category: 'Science', difficulty: 'easy' });
    repo.insert({ playerName: 'B', score: 10, total: 10, category: 'History', difficulty: 'easy' });
    repo.insert({ playerName: 'C', score: 5, total: 10, category: 'Science', difficulty: 'hard' });

    const scienceOnly = repo.top({ limit: 10, category: 'Science' });
    expect(scienceOnly.map((e) => e.playerName)).toEqual(['A', 'C']);

    const easyOnly = repo.top({ limit: 10, difficulty: 'easy' });
    expect(easyOnly.map((e) => e.playerName).sort()).toEqual(['A', 'B']);
  });

  it('computes percentage server-side so clients can trust it', () => {
    repo.insert({ playerName: 'A', score: 3, total: 10, category: null, difficulty: null });
    const [entry] = repo.top({ limit: 1 });
    expect(entry?.percentage).toBe(30);
  });

  it('breaks ties by earliest createdAt', () => {
    const first = repo.insert({
      playerName: 'Early',
      score: 5,
      total: 10,
      category: null,
      difficulty: null,
    });
    const second = repo.insert({
      playerName: 'Late',
      score: 5,
      total: 10,
      category: null,
      difficulty: null,
    });
    // Both rank 1 (nobody has strictly higher %); top() orders by time.
    expect(first.rank).toBe(1);
    expect(second.rank).toBe(1);
    const top = repo.top({ limit: 10 });
    expect(top[0]?.playerName).toBe('Early');
  });
});
