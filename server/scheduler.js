// server/scheduler.js

class Scheduler {
  constructor(db, workerPool) {
    this.db = db;
    this.workerPool = workerPool;
    this.intervalId = null;
    this.POLL_INTERVAL_MS = 2000;
  }

  start() {
    console.log('[Scheduler] Started - polling every', this.POLL_INTERVAL_MS, 'ms');
    this.intervalId = setInterval(() => this._tick(), this.POLL_INTERVAL_MS);
    this._tick();
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  async _tick() {
    const queuedJobs = this.db.query(
      `SELECT * FROM jobs WHERE status = 'queued' ORDER BY created_at ASC`
    );

    if (queuedJobs.length === 0) return;

    for (const job of queuedJobs) {
      const assigned = await this.workerPool.assignJob(job);
      if (!assigned) {
        console.log(`[Scheduler] No worker available for job ${job.id} - will retry`);
        break;
      }
    }
  }

  getStats() {
    const queued  = this.db.queryOne(`SELECT COUNT(*) as c FROM jobs WHERE status = 'queued'`).c;
    const running = this.db.queryOne(`SELECT COUNT(*) as c FROM jobs WHERE status = 'running'`).c;
    const success = this.db.queryOne(`SELECT COUNT(*) as c FROM jobs WHERE status = 'success'`).c;
    const failed  = this.db.queryOne(`SELECT COUNT(*) as c FROM jobs WHERE status = 'failed'`).c;
    return { queued, running, success, failed, total: queued + running + success + failed };
  }
}

module.exports = { Scheduler };
