import { useEffect, useState } from 'react';
import type { Category, Difficulty, LeaderboardEntry } from '@quiz-kata/shared';
import { api, ApiRequestError } from '../api.ts';

// Leaderboard: filter row + table. Filter changes trigger one refetch
// via dep array; no double-fetch when two filters change together.

const DIFFICULTY_OPTIONS: Array<{ value: Difficulty | ''; label: string }> = [
  { value: '', label: 'All' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
};

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('');
  const [category, setCategory] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    // Non-fatal — leaderboard works without the filter.
    api.categories().then((res) => setCategories(res.categories)).catch(() => {});
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    api
      .leaderboard({
        limit: 20,
        difficulty: difficulty || undefined,
        category: category || undefined,
      })
      .then((res) => setEntries(res.entries))
      .catch((e: unknown) => {
        setError(e instanceof ApiRequestError ? e.body.message : 'Failed to load');
      })
      .finally(() => setIsLoading(false));
  }, [difficulty, category]);

  return (
    <main className="content">
      <section>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Top 20
        </div>
        <h1 className="h-display">Leaderboard.</h1>
        <p className="lede" style={{ marginTop: 12 }}>
          Ranked by percentage. Ties go to whoever got there first.
        </p>
      </section>

      <section className="card">
        <div className="row" style={{ gap: 20 }}>
          <div className="field">
            <label>Difficulty</label>
            <div className="segment" role="radiogroup" aria-label="Difficulty filter">
              {DIFFICULTY_OPTIONS.map((opt) => (
                <button
                  key={opt.value || 'all'}
                  type="button"
                  role="radio"
                  aria-checked={difficulty === opt.value}
                  className={difficulty === opt.value ? 'active' : undefined}
                  onClick={() => setDifficulty(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label>Category</label>
            <select
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={categories.length === 0}
            >
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {isLoading && <p className="muted">Loading…</p>}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      {!isLoading && !error && entries.length === 0 && (
        <div className="card text-center">
          <p style={{ marginBottom: 4 }}>No scores here yet.</p>
          <p className="muted">Be the first to post one.</p>
        </div>
      )}

      {entries.length > 0 && (
        <table className="lb">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Score</th>
              <th>Category</th>
              <th>Difficulty</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr key={entry.id}>
                <td className={`rank${i < 3 ? ' top' : ''}`}>#{i + 1}</td>
                <td>
                  <span className="player">{entry.playerName}</span>
                </td>
                <td className="score">
                  {entry.score}/{entry.total} · {entry.percentage}%
                </td>
                <td>{entry.category ?? <span className="muted">Any</span>}</td>
                <td>
                  {entry.difficulty ? (
                    <span className="chip ghost">{entry.difficulty}</span>
                  ) : (
                    <span className="muted">Any</span>
                  )}
                </td>
                <td>
                  <span className="meta">{formatDate(entry.createdAt)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
