import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Category } from '@quiz-kata/shared';
import { api } from '../api.ts';
import { peekActiveQuiz } from '../quizSession.ts';

// Home: category grid + a resume tile when there's an in-flight quiz.
// Clicks go to /setup?category=ID to pick amount + difficulty.

const ANY_ID = 'any';

// Category tile "icon" = first letter in serif italic.
const iconFor = (name: string): string => {
  const first = name.trim().charAt(0);
  return first || '◆';
};

export default function Home() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const resume = useMemo(() => peekActiveQuiz(), []);

  useEffect(() => {
    api
      .categories()
      .then((res) => setCategories(res.categories))
      .catch(() =>
        setCategoriesError("Couldn't load categories — try 'Any' for now."),
      );
  }, []);

  const goToSetup = (categoryId: number | typeof ANY_ID) => {
    const qs = categoryId === ANY_ID ? '' : `?category=${categoryId}`;
    navigate(`/setup${qs}`);
  };

  const resumeAnswered = resume
    ? Object.keys(resume.answers).length
    : 0;
  const resumeTotal = resume?.questions.length ?? 0;
  const resumeCategory =
    resume?.questions[0]?.category ?? 'in-flight round';

  return (
    <main className="content">
      <section>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Ready when you are
        </div>
        <h1 className="h-display">
          Pick <em>your battle.</em>
        </h1>
        <p className="lede" style={{ marginTop: 12 }}>
          Choose a topic to start. We’ll hand you ten questions by default —
          you can tweak the count and difficulty on the next screen.
        </p>
      </section>

      <section>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Quick return
        </div>
        <div className="quick-grid">
          {resume ? (
            <Link
              to={`/quiz/${resume.quizId}`}
              className="quick-card dark"
              aria-label="Resume your in-progress quiz"
            >
              <div className="eyebrow" style={{ color: 'var(--n-300)' }}>
                Resume
              </div>
              <div className="quick-title">{resumeCategory}</div>
              <div className="meta">
                {resumeAnswered} / {resumeTotal} answered
              </div>
              <div
                className="quiz-progress-bar"
                style={{ marginTop: 12, background: 'rgba(255,255,255,0.18)' }}
                aria-hidden
              >
                <div
                  className="quiz-progress-fill"
                  style={{
                    width: `${(resumeAnswered / resumeTotal) * 100}%`,
                    background: 'var(--n-0)',
                  }}
                />
              </div>
            </Link>
          ) : (
            <div className="quick-card muted" aria-disabled>
              <div className="eyebrow">Resume</div>
              <div className="quick-title">No round in progress</div>
              <div className="meta">Pick a topic below to start.</div>
            </div>
          )}

          <div
            className="quick-card muted"
            aria-disabled
            title="Pending"
          >
            <div className="row row-between">
              <div className="eyebrow">Daily challenge</div>
              <span className="chip ghost">Soon</span>
            </div>
            <div className="quick-title">Today’s quiz</div>
            <div className="meta">One round, everyone gets the same.</div>
          </div>
        </div>
      </section>

      <section>
        <div className="row row-between" style={{ marginBottom: 12 }}>
          <div className="eyebrow">Topics</div>
          <div className="meta">{categories.length || '—'} categories</div>
        </div>
        {categoriesError && (
          <p className="hint" style={{ marginBottom: 12 }}>
            {categoriesError}
          </p>
        )}
        <div className="cat-grid">
          <button
            className="cat-tile"
            onClick={() => goToSetup(ANY_ID)}
            style={{ background: 'var(--n-900)', borderColor: 'var(--n-900)' }}
          >
            <div className="cat-icon" style={{ color: 'var(--n-0)' }}>
              <em>✶</em>
            </div>
            <div className="cat-name" style={{ color: 'var(--n-0)' }}>
              Any category
            </div>
            <div className="cat-count" style={{ color: 'var(--n-400)' }}>
              Surprise me
            </div>
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className="cat-tile"
              onClick={() => goToSetup(c.id)}
            >
              <div className="cat-icon">
                <em>{iconFor(c.name)}</em>
              </div>
              <div className="cat-name">{c.name}</div>
              <div className="cat-count">Any level</div>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
