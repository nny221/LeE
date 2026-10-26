import type { DatabaseSync } from 'node:sqlite'

export function runMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term TEXT NOT NULL,
      normalized_term TEXT NOT NULL UNIQUE,
      term_type TEXT NOT NULL DEFAULT 'word',
      phonetic TEXT NOT NULL DEFAULT '',
      part_of_speech TEXT NOT NULL DEFAULT '',
      meaning TEXT NOT NULL,
      example TEXT NOT NULL DEFAULT '',
      example_translation TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      source_excerpt TEXT NOT NULL DEFAULT '',
      import_batch_id TEXT,
      enrichment_status TEXT NOT NULL DEFAULT 'complete',
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

  addColumnIfMissing(
    db,
    'words',
    'term_type',
    "TEXT NOT NULL DEFAULT 'word'"
  )
  addColumnIfMissing(
    db,
    'words',
    'part_of_speech',
    "TEXT NOT NULL DEFAULT ''"
  )
  addColumnIfMissing(
    db,
    'words',
    'example_translation',
    "TEXT NOT NULL DEFAULT ''"
  )
  addColumnIfMissing(
    db,
    'words',
    'source_excerpt',
    "TEXT NOT NULL DEFAULT ''"
  )
  addColumnIfMissing(db, 'words', 'import_batch_id', 'TEXT')
  addColumnIfMissing(
    db,
    'words',
    'enrichment_status',
    "TEXT NOT NULL DEFAULT 'complete'"
  )

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_words_import_batch
      ON words(import_batch_id);
  `)
}

function addColumnIfMissing(
  db: DatabaseSync,
  table: string,
  column: string,
  definition: string
): void {
  const columns = db
    .prepare(`PRAGMA table_info(${table})`)
    .all() as Array<{ name: string }>

  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}
