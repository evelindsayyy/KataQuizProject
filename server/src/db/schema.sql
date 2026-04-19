-- One row per completed quiz attempt.

CREATE TABLE IF NOT EXISTS leaderboard (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    player_name TEXT    NOT NULL,
    score       INTEGER NOT NULL CHECK (score >= 0),
    total       INTEGER NOT NULL CHECK (total > 0),
    category    TEXT,           -- null = any
    difficulty  TEXT CHECK (difficulty IN ('easy', 'medium', 'hard') OR difficulty IS NULL),
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CHECK (score <= total)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_filter
    ON leaderboard(category, difficulty);
