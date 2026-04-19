import { NavLink, Route, Routes } from 'react-router-dom';
import Home from './pages/Home.tsx';
import Setup from './pages/Setup.tsx';
import Quiz from './pages/Quiz.tsx';
import Results from './pages/Results.tsx';
import Leaderboard from './pages/Leaderboard.tsx';

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'active' : undefined;

export default function App() {
  return (
    <div className="frame">
      <header className="topbar">
        <NavLink to="/" className="logo" aria-label="Quizzly home">
          Quizzly
        </NavLink>
        <nav className="topbar-nav" aria-label="Primary">
          <NavLink to="/" end className={navClass}>
            Play
          </NavLink>
          <NavLink to="/leaderboard" className={navClass}>
            Leaderboard
          </NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/quiz/:quizId" element={<Quiz />} />
        <Route path="/results" element={<Results />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
      </Routes>
    </div>
  );
}
