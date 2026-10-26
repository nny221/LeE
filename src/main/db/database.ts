import { app } from 'electron'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { runMigrations } from './migrations'

export function openDatabase(): DatabaseSync {
  const databasePath = join(app.getPath('userData'), 'lee.db')
  const db = new DatabaseSync(databasePath)

  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')
  runMigrations(db)

  return db
}
