import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { ClientQuestion, SubmittedAnswer } from '@quiz-kata/shared';
import { api, ApiRequestError } from '../api.ts';
import {
  clearActiveQuiz,
  loadActiveQuiz,
  loadPlayerName,
  saveActiveQuiz,
  savePlayerName,
} from '../quizSession.ts';

// Quiz: one question at a time. Questions + answers round-trip through
// sessionStorage so a refresh doesn't blow up the round.
// Keyboard: A-D / 1-4 select, ←/→ and Enter navigate.

interface LocationState {
  questions?: ClientQuestion[];
}

const KEY_LABELS = ['A', 'B', 'C', 'D'];

export default function Quiz() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const hydrated = useMemo(() => {
    if (!quizId) return null;
    const fromRouter = (location.state as LocationState | null)?.questions;
    if (fromRouter) {
      return { questions: fromRouter, answers: {} as Record<string, string> };
    }
    const stored = loadActiveQuiz(quizId);
    if (stored) {
      return { questions: stored.questions, answers: stored.answers };
    }
    return null;
  }, [quizId, location.state]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(
    hydrated?.answers ?? {},
  );
  const [playerName, setPlayerName] = useState<string>(loadPlayerName());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!quizId || !hydrated) return;
    saveActiveQuiz({ quizId, questions: hydrated.questions, answers });
  }, [quizId, hydrated, answers]);

  const goNext = useCallback(() => {
    if (!hydrated) return;
    setCurrentIndex((i) => (i < hydrated.questions.length - 1 ? i + 1 : i));
  }, [hydrated]);
  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : 0));
  }, []);

  const selectAnswer = useCallback((questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const current = hydrated.questions[currentIndex];
      if (!current) return;
      const letter = e.key.toUpperCase();
      const byLetter = KEY_LABELS.indexOf(letter);
      const byNumber = e.key >= '1' && e.key <= '4' ? Number(e.key) - 1 : -1;
      const idx = byLetter >= 0 ? byLetter : byNumber;
      if (idx >= 0 && idx < current.options.length) {
        e.preventDefault();
        selectAnswer(current.id, current.options[idx]!);
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hydrated, currentIndex, selectAnswer, goNext, goPrev]);

  if (!quizId || !hydrated) {
    return (
      <main className="content center">
        <div className="card text-center" style={{ maxWidth: 380 }}>
          <h2 className="h2" style={{ marginBottom: 8 }}>
            No active quiz
          </h2>
          <p className="muted" style={{ marginBottom: 16 }}>
            Your session may have expired.
          </p>
          <Link to="/" className="btn primary">
            Start a new one
          </Link>
        </div>
      </main>
    );
  }

  const { questions } = hydrated;
  const current = questions[currentIndex];
  if (!current) return <div>No question to show.</div>;
  const isLast = currentIndex === questions.length - 1;
  const selected = answers[current.id];
  const answeredCount = Object.keys(answers).length;
  const progressPct = ((currentIndex + 1) / questions.length) * 100;
  const progressLabel = `${String(currentIndex + 1).padStart(2, '0')} / ${String(questions.length).padStart(2, '0')}`;

  const handleSubmit = async () => {
    const trimmedName = playerName.trim();
    if (trimmedName.length === 0) {
      setError('Please enter a name before submitting.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const submittedAnswers: SubmittedAnswer[] = Object.entries(answers).map(
      ([questionId, answer]) => ({ questionId, answer }),
    );
    try {
      savePlayerName(trimmedName);
      const result = await api.submitQuiz(quizId, {
        answers: submittedAnswers,
        playerName: trimmedName,
      });
      clearActiveQuiz();
      navigate('/results', { state: { result, questions } });
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.body.message : 'Submit failed');
      setIsSubmitting(false);
    }
  };

  return (
    <main className="content quiz">
      <div className="quiz-progress">
        <span className="meta" style={{ width: 64 }}>
          {progressLabel}
        </span>
        <div className="quiz-progress-bar">
          <div className="quiz-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="meta">
          {answeredCount} / {questions.length}
        </span>
      </div>

      <div className="eyebrow">
        {current.category} · {current.difficulty}
      </div>

      {/*
        dangerouslySetInnerHTML is OK here because the source is OpenTDB
        (not user input) — their questions carry HTML entities. Swap to
        DOMPurify if we ever accept user-authored quizzes.
      */}
      <h2
        className="question"
        dangerouslySetInnerHTML={{ __html: current.question }}
      />

      <div className="answers" role="radiogroup" aria-label="Answer options">
        {current.options.map((option, i) => {
          const isSelected = selected === option;
          return (
            <button
              key={option}
              className={`answer${isSelected ? ' selected' : ''}`}
              aria-pressed={isSelected}
              onClick={() => selectAnswer(current.id, option)}
            >
              <span className="answer-key" aria-hidden>
                {KEY_LABELS[i] ?? i + 1}
              </span>
              <span style={{ flex: 1 }}>{option}</span>
            </button>
          );
        })}
      </div>

      <div className="quiz-footer">
        <button
          className="btn ghost"
          onClick={goPrev}
          disabled={currentIndex === 0}
        >
          ← Previous
        </button>
        <span className="meta">
          A–D select · ← → navigate · ↵ next
        </span>
        {!isLast && (
          <button className="btn primary" onClick={goNext} disabled={!selected}>
            Next
            <span className="kbd">↵</span>
          </button>
        )}
        {isLast && <span style={{ width: 80 }} aria-hidden />}
      </div>

      {isLast && (
        <section className="card" style={{ marginTop: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Final step
          </div>
          <h3 className="h2" style={{ marginBottom: 16 }}>
            Sign off and submit
          </h3>
          <div className="field">
            <label htmlFor="player-name">Your name</label>
            <input
              id="player-name"
              type="text"
              className="input"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={40}
              placeholder="e.g. Alex"
              style={{ maxWidth: 320 }}
            />
          </div>
          <div className="row row-between" style={{ marginTop: 16 }}>
            {answeredCount < questions.length ? (
              <span className="hint">
                {questions.length - answeredCount} unanswered — counts as wrong.
              </span>
            ) : (
              <span className="meta">All answered</span>
            )}
            <button
              className="btn primary"
              onClick={handleSubmit}
              disabled={isSubmitting || answeredCount === 0}
            >
              {isSubmitting ? 'Submitting…' : 'Submit quiz'}
              <span className="kbd">↵</span>
            </button>
          </div>
        </section>
      )}

      {error && (
        <p className="alert" role="alert" style={{ marginTop: 16 }}>
          {error}
        </p>
      )}
    </main>
  );
}
