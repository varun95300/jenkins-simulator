// workers/workerPool.js

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDuration(base = 3000, jitter = 9000) {
  return base + Math.floor(Math.random() * jitter);
}

function didJobFail() {
  return Math.random() < 0.15;
}

function generateLog(job, worker, failed) {
  const steps = {
    python:     ['pip install -r requirements.txt', 'python -m pytest tests/', 'coverage report'],
    javascript: ['npm install', 'npm test', 'npm run build'],
    java:       ['mvn dependency:resolve', 'mvn test', 'mvn package'],
    general:    ['echo "Running generic pipeline"', 'make test', 'make build'],
  };

  const cmds = steps[worker.specialty] || steps.general;
  let log = `[${worker.name}] Starting job ${job.id}\n`;
  log += `[${worker.name}] Repo: ${job.repo_name} | Branch: ${job.branch}\n`;
  log += `[${worker.name}] Commit: ${job.commit_hash}\n\n`;

  for (const cmd of cmds) {
    log += `$ ${cmd}\n`;
    if (failed && cmd === cmds[cmds.length - 1]) {
      log += `ERROR: Step failed with exit code 1\n`;
    } else {
      log += `✓ Done\n`;
    }
  }

  log += failed
    ? `\n[${worker.name}] ❌ Job FAILED`
    : `\n[${worker.name}] ✅ Job PASSED`;

  return log;
}

class WorkerPool {
  constructor(db) {
    this.db = db;
  }

  findWorker(language) {
    // Find idle workers - prefer matching specialty, fall back to general, then any idle
    const workers = this.db.query(
      `SELECT * FROM workers WHERE status = 'idle' ORDER BY
        CASE WHEN specialty = ? THEN 0
             WHEN specialty = 'general' THEN 1
             ELSE 2 END ASC`,
      [language]
    );
    return workers[0] || null;
  }

  async assignJob(job) {
    const worker = this.findWorker(job.language);
    if (!worker) return false;

    this.db.execute(
      `UPDATE workers SET status = 'busy', current_job_id = ? WHERE id = ?`,
      [job.id, worker.id]
    );

    this.db.execute(
      `UPDATE jobs SET status = 'running', worker_id = ?, started_at = datetime('now') WHERE id = ?`,
      [worker.id, job.id]
    );

    console.log(`[Scheduler] Assigned job ${job.id} (${job.language}) → ${worker.name}`);
    this._executeJob(job, worker); // fire and forget
    return true;
  }

  async _executeJob(job, worker) {
    const duration = randomDuration();
    const failed = didJobFail();

    await sleep(duration);

    const log = generateLog(job, worker, failed);
    const status = failed ? 'failed' : 'success';

    this.db.execute(
      `UPDATE jobs SET status = ?, finished_at = datetime('now'), duration_ms = ?, log = ?, result = ? WHERE id = ?`,
      [status, duration, log, status, job.id]
    );

    this.db.execute(
      `UPDATE workers SET status = 'idle', current_job_id = NULL,
        jobs_completed = jobs_completed + ?,
        jobs_failed = jobs_failed + ?
       WHERE id = ?`,
      [failed ? 0 : 1, failed ? 1 : 0, worker.id]
    );

    console.log(`[Worker] ${worker.name} finished job ${job.id} → ${status.toUpperCase()} (${duration}ms)`);
  }

  getAllWorkers() {
    return this.db.query('SELECT * FROM workers');
  }
}

module.exports = { WorkerPool };
