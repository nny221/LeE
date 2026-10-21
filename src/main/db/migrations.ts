import type { DatabaseSync } from 'node:sqlite'

export function runMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term TEXT NOT NULL,
      normalized_term TEXT NOT NULL UNIQUE,
      phonetic TEXT NOT NULL DEFAULT '',
      meaning TEXT NOT NULL,
      example TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS review_states (
      word_id INTEGER PRIMARY KEY,
      familiarity TEXT NOT NULL DEFAULT 'new'
        CHECK (familiarity IN ('new', 'familiar', 'fuzzy', 'forgotten')),
      interval_days REAL NOT NULL DEFAULT 0,
      ease REAL NOT NULL DEFAULT 2.5,
      review_count INTEGER NOT NULL DEFAULT 0,
      lapse_count INTEGER NOT NULL DEFAULT 0,
      last_reviewed_at INTEGER,
      next_due_at INTEGER NOT NULL,
      FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS review_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER NOT NULL,
      rating TEXT NOT NULL CHECK (rating IN ('good', 'partial', 'wrong')),
      previous_familiarity TEXT NOT NULL,
      new_familiarity TEXT NOT NULL,
      reviewed_at INTEGER NOT NULL,
      next_due_at INTEGER NOT NULL,
      FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_review_states_due
      ON review_states(next_due_at);
    CREATE INDEX IF NOT EXISTS idx_review_events_word
      ON review_events(word_id, reviewed_at);
  `)
}
