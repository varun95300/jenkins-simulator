# Jenkins CI/CD Simulator

A simulated Jenkins-like CI/CD pipeline system built with Node.js. This project mimics how real CI/CD tools like Jenkins work — receiving webhook triggers, queuing jobs, scheduling them, and executing them across multiple specialized workers.

---

## System Architecture

```
GitHub Push (simulated)
        │
        ▼
  POST /webhook
        │
        ▼
┌─────────────────────┐
│   Jenkins Master     │  ← Node.js Express server (server/index.js)
│   (Express Server)   │
└─────────┬───────────┘
          │ stores job
          ▼
┌─────────────────────┐
│   Job Queue (DB)     │  ← SQLite in-memory database (db/database.js)
│   status: queued     │
└─────────┬───────────┘
          │ polls every 2s
          ▼
┌─────────────────────┐
│     Scheduler        │  ← Pipeline manager (server/scheduler.js)
│  (assigns workers)   │
└──┬──────┬──────┬────┘
   │      │      │
   ▼      ▼      ▼
[W1]   [W2]   [W3]   [W4]    ← Simulated workers (workers/workerPool.js)
Python  Node  Java  General
```

---

## Project Structure

```
jenkins-simulator/
├── server/
│   ├── index.js         # Jenkins Master — Express server, webhook receiver, REST API
│   └── scheduler.js     # Pipeline scheduler — polls queue, assigns jobs to workers
├── workers/
│   └── workerPool.js    # 4 simulated CI workers with language specialties
├── db/
│   └── database.js      # SQLite database — job queue and worker state
├── public/
│   └── index.html       # Live dashboard UI (auto-refreshes every 2s)
└── package.json
```

---

## How to Run

### Prerequisites
- [Node.js](https://nodejs.org) (LTS version)

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open the dashboard
# Visit http://localhost:3000 in your browser
```

---

## Features

### 1. Webhook Triggers
Simulates GitHub webhook POST requests that trigger CI/CD jobs.

```bash
# Simulate a code push
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"repo": "my-app", "branch": "main", "language": "python", "commit": "abc123"}'
```

### 2. Job Queue (Database)
Every incoming webhook creates a job record in a SQLite database with status tracking:
```
queued → running → success / failed
```

### 3. Pipeline Scheduler
Runs every 2 seconds, picks the oldest queued job, and assigns it to the best available worker. Implements FIFO (First In, First Out) scheduling.

### 4. Multi-Worker Execution with Language Routing
4 concurrent workers, each with a specialty:

| Worker | Specialty | Handles |
|--------|-----------|---------|
| Worker 1 | Python | `pip install`, `pytest` |
| Worker 2 | Node.js | `npm install`, `npm test` |
| Worker 3 | Java | `mvn dependency:resolve`, `mvn test` |
| Worker 4 | General | Overflow / any language |

Assignment logic: Python job → Python Worker first, falls back to General Worker if busy.

### 5. Simulated Randomness
- Job execution time: **3–12 seconds** (random, simulates real test suite duration)
- Failure rate: **15%** (simulates flaky tests, compile errors)
- Random job generator: picks random repos, branches, and languages

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/webhook` | Receive a webhook trigger (like GitHub) |
| `POST` | `/simulate` | Generate a random job |
| `GET` | `/jobs` | List all jobs (supports `?status=queued\|running\|success\|failed`) |
| `GET` | `/jobs/:id` | Get a single job with its build log |
| `GET` | `/workers` | Get all worker statuses |
| `GET` | `/stats` | Dashboard statistics |
| `GET` | `/health` | Server health check |

---

## Dashboard

The live dashboard at `http://localhost:3000` shows:
- Real-time job queue with status badges
- Worker cards showing idle/busy state and job counts
- Click any job row to view its full build log
- Buttons to trigger single jobs, random jobs, or bursts of 5

---

## Assignment Requirements Mapping

| Requirement | Implementation |
|-------------|----------------|
| GitHub repository | This repo |
| Webhook triggers | `POST /webhook` endpoint in `server/index.js` |
| Jenkins Master backend | Express server (`server/index.js`) |
| Database/queue | SQLite via `db/database.js` |
| Pipeline manager & scheduler | `server/scheduler.js` — polls every 2s |
| Multiple workers (3–4) | 4 workers in `workers/workerPool.js` |
| Language-based worker assignment | `findWorker()` function with priority ordering |
| Randomness in job arrivals | `/simulate` endpoint + random duration/failure |

---

## Technologies Used

- **Node.js** — Runtime
- **Express.js** — Web server / REST API
- **sql.js** — In-memory SQLite database (pure JavaScript)
- **uuid** — Unique job ID generation
- **HTML/CSS/JS** — Live dashboard frontend
