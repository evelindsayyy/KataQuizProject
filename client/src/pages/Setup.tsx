import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { Category, Difficulty } from '@quiz-kata/shared';
import { api, ApiRequestError } from '../api.ts';
import { saveActiveQuiz } from '../quizSession.ts';

// Setup: reads ?category=ID, picks difficulty + amount, starts the round.

const DIFFICULTY_OPTIONS: Array<{ value: Difficulty | ''; label: string }> = [
  { value: '', label: 'Any' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const AMOUNT_TICKS = [5, 10, 15, 20];

export default function Setup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get('category');
  const parsedCategoryId = categoryId ? Number(categoryId) : null;

  const [categories, setCategories] = useState<Category[]>([]);
  const [amount, setAmount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Non-fatal if this fails — still works without the name lookup.
    api.categories().then((res) => setCategories(res.categories)).catch(() => {});
  }, []);

  const categoryName = useMemo(() => {
    if (parsedCategoryId === null) return 'Any category';
    const match = categories.find((c) => c.id === parsedCategoryId);
    return match?.name ?? `Category ${parsedCategoryId}`;
  }, [parsedCategoryId, categories]);

  const handleStart = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { quizId, questions } = await api.startQuiz({
        amount,
        category: parsedCategoryId ?? undefined,
        difficulty: difficulty || undefined,
      });
      saveActiveQuiz({ quizId, questions, answers: {} });
      navigate(`/quiz/${quizId}`, { state: { questions } });
    } catch (e) {
      setError(
        e instanceof ApiRequestError
          ? e.body.message
          : 'Something went wrong. Try again?',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const activeTick = AMOUNT_TICKS.indexOf(amount);

  return (
    <main className="content">
      <div>
        <Link to="/" className="meta">
          ← Back to topics
        </Link>
      </div>

      <section>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Quiz setup
        </div>
        <h1 className="h-display">{categoryName}</h1>
        <p className="lede" style={{ marginTop: 12 }}>
          Pick how many questions and how hard. Questions are pulled fresh
          from OpenTDB each round.
        </p>
      </section>

      <section className="card" style={{ maxWidth: 540 }}>
        <div className="stack">
          <div className="field">
            <label>Difficulty</label>
            <div className="segment" role="radiogroup" aria-label="Difficulty">
              {DIFFICULTY_OPTIONS.map((opt) => (
                <button
                  key={opt.value || 'any'}
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

          <div className="field">
            <label>Questions</label>
            <div className="segment" role="radiogroup" aria-label="Question count">
              {AMOUNT_TICKS.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={amount === n}
                  className={amount === n ? 'active' : undefined}
                  onClick={() => setAmount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="tick-row" aria-hidden>
              {AMOUNT_TICKS.map((_, i) => (
                <div
                  key={i}
                  className={`tick${i <= activeTick ? ' on' : ''}`}
                />
              ))}
            </div>
          </div>

          <div className="field">
            <label>Or pick any number (1–50)</label>
            <input
              type="number"
              className="input"
              min={1}
              max={50}
              value={amount}
              onChange={(e) => {
                const n = Number(e.target.value);
                setAmount(Number.isFinite(n) ? n : 1);
              }}
              style={{ maxWidth: 160 }}
            />
          </div>

          <div className="hr" />

          <div className="row row-between">
            <span className="meta">
              {amount} question{amount === 1 ? '' : 's'} ·{' '}
              {difficulty || 'any difficulty'}
            </span>
            <button
              className="btn primary lg"
              onClick={handleStart}
              disabled={isLoading}
            >
              {isLoading ? 'Loading…' : 'Start quiz'}
              <span className="kbd">↵</span>
            </button>
          </div>

          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
