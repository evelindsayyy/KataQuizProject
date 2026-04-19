import { Link, useLocation } from 'react-router-dom';
import type { ClientQuestion, QuizSubmitResponse } from '@quiz-kata/shared';

// Results: score hero + stat row + per-question review. State comes from
// router state — if it's missing (refresh) we show a "start over" card
// because the server already dropped the quiz at submit time.

interface LocationState {
  result?: QuizSubmitResponse;
  questions?: ClientQuestion[];
}

const verdict = (pct: number): string => {
  if (pct === 100) return 'Flawless.';
  if (pct >= 80) return 'Sharp.';
  if (pct >= 60) return 'Solid.';
  if (pct >= 40) return 'Room to grow.';
  if (pct > 0) return 'Tough round.';
  return 'Brutal.';
};

export default function Results() {
  const location = useLocation();
  const state = location.state as LocationState | null;

  if (!state?.result || !state.questions) {
    return (
      <main className="content center">
        <div className="card text-center" style={{ maxWidth: 380 }}>
          <h2 className="h2" style={{ marginBottom: 8 }}>
            No results to show
          </h2>
          <p className="muted" style={{ marginBottom: 16 }}>
            Results only display once, right after you submit.
          </p>
          <Link to="/" className="btn primary">
            Back home
          </Link>
        </div>
      </main>
    );
  }

  const { result, questions } = state;
  const percentage = Math.round((result.score / result.total) * 100);
  const correctCount = result.results.filter((r) => r.isCorrect).length;
  const wrongCount = result.total - correctCount;

  return (
    <main className="content">
      <section>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Final score
        </div>
        <div className="score-hero">
          <span className="score-num">{result.score}</span>
          <span className="score-denom">/ {result.total}</span>
        </div>
        <p
          className="h-display"
          style={{ marginTop: 16, fontSize: 28, color: 'var(--n-500)' }}
        >
          <em>{verdict(percentage)}</em>
        </p>
      </section>

      <section className="stat-row">
        <div className="stat">
          <div className="stat-label">Percentage</div>
          <div className="stat-value">{percentage}%</div>
        </div>
        <div className="stat">
          <div className="stat-label">Correct</div>
          <div className="stat-value">{correctCount}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Wrong</div>
          <div className="stat-value">{wrongCount}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Rank</div>
          <div className="stat-value">
            {result.leaderboardRank !== undefined
              ? `#${result.leaderboardRank}`
              : '—'}
          </div>
        </div>
      </section>

      <section>
        <div className="row row-between" style={{ marginBottom: 8 }}>
          <h2 className="h2">Review</h2>
          <span className="meta">
            {correctCount} correct · {wrongCount} wrong
          </span>
        </div>
        <div className="review">
          {questions.map((q, i) => {
            const detail = result.results.find((r) => r.questionId === q.id);
            if (!detail) return null;
            return (
              <div key={q.id} className="review-item">
                <span
                  className={`review-mark ${detail.isCorrect ? 'c' : 'x'}`}
                  aria-hidden
                >
                  {detail.isCorrect ? '✓' : '✗'}
                </span>
                <div style={{ flex: 1 }}>
                  <div className="meta" style={{ marginBottom: 4 }}>
                    Q{String(i + 1).padStart(2, '0')}
                  </div>
                  <div
                    className="review-q"
                    dangerouslySetInnerHTML={{ __html: q.question }}
                  />
                  <div className="review-a">
                    YOU · {detail.submittedAnswer || '(no answer)'}
                    {!detail.isCorrect && (
                      <>
                        {'  '}·  ANSWER · {detail.correctAnswer}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="row" style={{ marginTop: 8 }}>
        <Link to="/" className="btn primary">
          Play again
        </Link>
        <Link to="/leaderboard" className="btn">
          View leaderboard
        </Link>
      </div>
    </main>
  );
}
