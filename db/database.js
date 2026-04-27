// db/database.js
// Uses sql.js - a pure JavaScript SQLite port. No C++ compiler needed!

const initSqlJs = require('sql.js');

// We store the DB instance here so the whole app shares one connection
let dbInstance = null;

async function initDB() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      repo_name TEXT NOT NULL,
      branch TEXT NOT NULL,
      language TEXT NOT NULL,
      commit_hash TEXT NOT NULL,
      status TEXT DEFAULT 'queued',
      worker_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      started_at TEXT,
      finished_at TEXT,
      duration_ms INTEGER,
      result TEXT,
      log TEXT
    );

    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      specialty TEXT NOT NULL,
      status TEXT DEFAULT 'idle',
      current_job_id TEXT,
      jobs_completed INTEGER DEFAULT 0,
      jobs_failed INTEGER DEFAULT 0
    );
  `);

  // Seed 4 workers
  const workers = [
    { id: 'worker-1', name: 'Python Worker',  specialty: 'python'     },
    { id: 'worker-2', name: 'Node.js Worker', specialty: 'javascript' },
    { id: 'worker-3', name: 'Java Worker',    specialty: 'java'       },
    { id: 'worker-4', name: 'General Worker', specialty: 'general'    },
  ];

  for (const w of workers) {
    db.run(
      `INSERT OR IGNORE INTO workers (id, name, specialty) VALUES (?, ?, ?)`,
      [w.id, w.name, w.specialty]
    );
  }

  // Helper: run a SELECT and return array of row objects
  db.query = function(sql, params = []) {
    const stmt = this.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  };

  // Helper: run a SELECT and return the first row only
  db.queryOne = function(sql, params = []) {
    const rows = this.query(sql, params);
    return rows[0] || null;
  };

  // Helper: run INSERT/UPDATE/DELETE
  db.execute = function(sql, params = []) {
    this.run(sql, params);
  };

  dbInstance = db;
  console.log('[DB] In-memory database initialized with', workers.length, 'workers');
  return db;
}

module.exports = { initDB };
