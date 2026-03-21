/**
 * lib/db.ts — SQLite preferences store
 *
 * Stores non-sensitive user customisations:
 *   - Budget limits per category
 *   - Account display names
 *   - UI settings (currency, theme, date format)
 *   - Category colours overrides
 *
 * Database file: data/preferences.db (volume-mounted, never committed)
 * NOT stored: passwords, card numbers, balances, transaction amounts.
 */
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'preferences.db')

let _db: Database.Database | null = null

function getDb(): Database.Database {
    if (_db) return _db

    // Ensure data dir exists
    fs.mkdirSync(DATA_DIR, { recursive: true })

    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')  // Better concurrent read performance

    // Schema — simple key/value store scoped by user identifier
    _db.exec(`
    CREATE TABLE IF NOT EXISTS preferences (
      user_key    TEXT NOT NULL,
      pref_key    TEXT NOT NULL,
      pref_value  TEXT NOT NULL,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_key, pref_key)
    );

    CREATE TABLE IF NOT EXISTS budget_limits (
      user_key    TEXT NOT NULL,
      category    TEXT NOT NULL,
      monthly_limit REAL NOT NULL,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_key, category)
    );
  `)

    return _db
}

// ─── Generic preferences ──────────────────────────────────────────

export function getPreference(userKey: string, key: string): unknown | null {
    const db = getDb()
    const row = db.prepare('SELECT pref_value FROM preferences WHERE user_key = ? AND pref_key = ?')
        .get(userKey, key) as { pref_value: string } | undefined
    if (!row) return null
    try { return JSON.parse(row.pref_value) } catch { return row.pref_value }
}

export function getAllPreferences(userKey: string): Record<string, unknown> {
    const db = getDb()
    const rows = db.prepare('SELECT pref_key, pref_value FROM preferences WHERE user_key = ?')
        .all(userKey) as Array<{ pref_key: string; pref_value: string }>
    return Object.fromEntries(rows.map(r => {
        try { return [r.pref_key, JSON.parse(r.pref_value)] } catch { return [r.pref_key, r.pref_value] }
    }))
}

export function setPreference(userKey: string, key: string, value: unknown): void {
    const db = getDb()
    db.prepare(`
    INSERT INTO preferences (user_key, pref_key, pref_value, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_key, pref_key) DO UPDATE SET
      pref_value = excluded.pref_value,
      updated_at = excluded.updated_at
  `).run(userKey, key, JSON.stringify(value))
}

// ─── Budget limits ────────────────────────────────────────────────

export function getBudgetLimits(userKey: string): Record<string, number> {
    const db = getDb()
    const rows = db.prepare('SELECT category, monthly_limit FROM budget_limits WHERE user_key = ?')
        .all(userKey) as Array<{ category: string; monthly_limit: number }>
    return Object.fromEntries(rows.map(r => [r.category, r.monthly_limit]))
}

export function setBudgetLimit(userKey: string, category: string, limit: number): void {
    const db = getDb()
    db.prepare(`
    INSERT INTO budget_limits (user_key, category, monthly_limit, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_key, category) DO UPDATE SET
      monthly_limit = excluded.monthly_limit,
      updated_at    = excluded.updated_at
  `).run(userKey, category, limit)
}

export function deleteBudgetLimit(userKey: string, category: string): void {
    const db = getDb()
    db.prepare('DELETE FROM budget_limits WHERE user_key = ? AND category = ?').run(userKey, category)
}
