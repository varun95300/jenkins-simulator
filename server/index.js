// server/index.js
const express  = require('express');
const cors     = require('cors');
const { v4: uuidv4 } = require('uuid');
const path     = require('path');

const { initDB }     = require('../db/database');
const { WorkerPool } = require('../workers/workerPool');
const { Scheduler }  = require('./scheduler');

const app  = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Bootstrap - must be async because sql.js loads via Promise
async function main() {
  const db         = await initDB();
  const workerPool = new WorkerPool(db);
  const scheduler  = new Scheduler(db, workerPool);
  scheduler.start();

  // ── Webhook ────────────────────────────────────────────────
  app.post('/webhook', (req, res) => {
    const { repo, branch, language, commit } = req.body;
    if (!repo || !language) {
      return res.status(400).json({ error: 'Missing required fields: repo, language' });
    }

    const SUPPORTED = ['python', 'javascript', 'java', 'general'];
    const lang = (language || 'general').toLowerCase();

    const job = {
      id:          uuidv4(),
      repo_name:   repo,
      branch:      branch  || 'main',
      language:    SUPPORTED.includes(lang) ? lang : 'general',
      commit_hash: commit  || 'HEAD',
    };

    db.execute(
      `INSERT INTO jobs (id, repo_name, branch, language, commit_hash) VALUES (?, ?, ?, ?, ?)`,
      [job.id, job.repo_name, job.branch, job.language, job.commit_hash]
    );

    console.log(`[Webhook] New job queued: ${job.id} | ${job.repo_name} | ${job.language}`);
    res.status(201).json({ message: 'Job queued successfully', job_id: job.id, status: 'queued' });
  });

  // ── Random job ────────────────────────────────────────────
  app.post('/simulate', (req, res) => {
    const repos = [
      { name: 'web-frontend',  language: 'javascript' },
      { name: 'api-service',   language: 'python'     },
      { name: 'data-pipeline', language: 'python'     },
      { name: 'auth-service',  language: 'java'       },
      { name: 'mobile-app',    language: 'javascript' },
      { name: 'ml-trainer',    language: 'python'     },
      { name: 'infra-scripts', language: 'general'    },
    ];
    const branches = ['main', 'develop', 'feature/login', 'hotfix/crash', 'release/v2'];
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];

    const template = pick(repos);
    const job = {
      id:          uuidv4(),
      repo_name:   template.name,
      branch:      pick(branches),
      language:    template.language,
      commit_hash: Math.random().toString(16).slice(2, 10),
    };

    db.execute(
      `INSERT INTO jobs (id, repo_name, branch, language, commit_hash) VALUES (?, ?, ?, ?, ?)`,
      [job.id, job.repo_name, job.branch, job.language, job.commit_hash]
    );

    console.log(`[Simulate] Random job queued: ${job.id} | ${job.repo_name}`);
    res.status(201).json({ message: 'Simulated job queued', job });
  });

  // ── List jobs ─────────────────────────────────────────────
  app.get('/jobs', (req, res) => {
    const { status } = req.query;
    const jobs = status
      ? db.query(`SELECT * FROM jobs WHERE status = ? ORDER BY created_at DESC LIMIT 100`, [status])
      : db.query(`SELECT * FROM jobs ORDER BY created_at DESC LIMIT 100`);
    res.json(jobs);
  });

  // ── Single job ────────────────────────────────────────────
  app.get('/jobs/:id', (req, res) => {
    const job = db.queryOne(`SELECT * FROM jobs WHERE id = ?`, [req.params.id]);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  });

  // ── Workers ───────────────────────────────────────────────
  app.get('/workers', (req, res) => res.json(workerPool.getAllWorkers()));

  // ── Stats ─────────────────────────────────────────────────
  app.get('/stats', (req, res) => res.json(scheduler.getStats()));

  // ── Health ────────────────────────────────────────────────
  app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  // ── Start ─────────────────────────────────────────────────
  app.listen(PORT, () => {
    console.log(`\n╔══════════════════════════════════════════╗`);
    console.log(`║   Jenkins Simulator running on :${PORT}   ║`);
    console.log(`╚══════════════════════════════════════════╝`);
    console.log(`\n  Dashboard → http://localhost:${PORT}`);
    console.log(`  Webhook   → POST http://localhost:${PORT}/webhook\n`);
  });

  process.on('SIGINT', () => { scheduler.stop(); process.exit(0); });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
