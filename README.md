# Policy Assessment API

Node.js + Express + MongoDB technical assessment: bulk data upload via worker threads, policy search, per-user aggregation, CPU monitoring with auto-restart, and a persisted message scheduler.

Repo: https://github.com/vinothmks1422/policy-assessment

## 1. Prerequisites

- Node.js 18+
- MongoDB running locally, or a MongoDB Atlas connection string
- [Postman](https://www.postman.com/downloads/) (or `curl`)

## 2. Setup

```bash
git clone https://github.com/vinothmks1422/policy-assessment.git
cd policy-assessment
npm install
cp .env.example .env
```

Edit `.env`:

```
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/policy_assessment
CPU_THRESHOLD=70
CPU_CHECK_INTERVAL_MS=1000
CPU_STRIKES=3
LOG_CPU=false
```

## 3. Run

```bash
npm run dev
```

On startup you should see two lines with different process IDs — this confirms the auto-restart wrapper is active:

```
Primary 1234 started
Server on 3000 (pid 5678)
```

Base URL for every endpoint below: `http://localhost:3000/api`

## 4. Postman setup

1. Open Postman → **New → Collection** → name it `Policy Assessment`.
2. Add a collection variable `baseUrl` = `http://localhost:3000/api`.
3. Create each request below inside that collection, using `{{baseUrl}}/...` as the URL.
4. For POST requests, set **Body → form-data** or **raw/JSON** as noted.

## 5. API Reference (7 endpoints)

### 5.1 Upload policy data — `POST /api/upload`

Uploads a `.csv` or `.xlsx` file and loads it into MongoDB using a worker thread.

- **Postman**: Body → `form-data` → key `file` (type: **File**) → choose the CSV/XLSX.
- **curl**:
  ```bash
  curl -F "file=@data-sheet_-_Node_js_Assesment_-_IM.csv" {{baseUrl}}/upload
  ```
- **Response 201**:
  ```json
  {
    "message": "Upload completed",
    "summary": {
      "totalRows": 1198,
      "skippedRows": 0,
      "collections": {
        "agents": { "inserted": 3, "updated": 0 },
        "lobs": { "inserted": 19, "updated": 0 },
        "carriers": { "inserted": 46, "updated": 0 },
        "users": { "inserted": 1198, "updated": 0 },
        "accounts": { "inserted": 1198, "updated": 0 },
        "policies": { "inserted": 1198, "updated": 0 }
      }
    }
  }
  ```
- Re-uploading the same file is safe — records are upserted, so counts move to `updated`.

### 5.2 Search policies by username — `GET /api/policies/search`

- **Postman**: GET → URL `{{baseUrl}}/policies/search` → Params tab → key `username`, value e.g. `Lura`.
- **curl**:
  ```bash
  curl "{{baseUrl}}/policies/search?username=Lura"
  ```
- Matches the `firstname` column, case-insensitive, partial match.
- **Response 200**:
  ```json
  { "count": 1, "data": [ { "policyNumber": "YEEX9MOIBU7X", "userId": { "firstName": "Lura Lucca", "email": "madler@yahoo.ca" }, "categoryId": { "categoryName": "Commercial Auto" }, "companyId": { "companyName": "Integon Gen Ins Corp" } } ] }
  ```

### 5.3 Aggregated policies per user — `GET /api/policies/aggregate`

- **Postman**: GET → URL `{{baseUrl}}/policies/aggregate` → Params: `page` (default 1), `limit` (default 20, max 100).
- **curl**:
  ```bash
  curl "{{baseUrl}}/policies/aggregate?page=1&limit=5"
  ```
- **Response 200**: array of users, each with `totalPolicies` and a `policies` array.

### 5.4 Schedule a message — `POST /api/messages/schedule`

Persists a message to run at a future day/time, so it survives a server restart.

- **Postman**: Body → `raw` → `JSON`:
  ```json
  {
    "message": "Hello from the scheduler",
    "day": "Friday",
    "time": "18:30"
  }
  ```
- **curl**:
  ```bash
  curl -X POST {{baseUrl}}/messages/schedule \
    -H "Content-Type: application/json" \
    -d '{"message":"Hello from the scheduler","day":"Friday","time":"18:30"}'
  ```
- `day` accepts a weekday name (`Monday`–`Sunday`, resolves to its next occurrence) or a calendar date (`YYYY-MM-DD`). `time` is 24-hour `HH:mm`, server-local time.
- **Response 201**:
  ```json
  { "id": "651...", "runAt": "2026-09-25T18:30:00.000Z", "status": "pending" }
  ```

### 5.5 List delivered messages — `GET /api/messages`

- **Postman**: GET → URL `{{baseUrl}}/messages`.
- **curl**:
  ```bash
  curl {{baseUrl}}/messages
  ```
- Returns the most recent 50 messages that have already fired (moved from `scheduled_messages` into `messages`).

### 5.6 Current CPU usage — `GET /api/system/cpu`

- **Postman**: GET → URL `{{baseUrl}}/system/cpu`.
- **curl**:
  ```bash
  curl {{baseUrl}}/system/cpu
  ```
- **Response 200**:
  ```json
  { "cpuPercent": 12.4, "threshold": 70, "at": "2026-09-25T10:00:00.000Z" }
  ```
- The server auto-restarts once CPU stays at/above `threshold` for `CPU_STRIKES` consecutive samples.

### 5.7 Burn CPU (dev/test helper only) — `GET /api/system/burn-cpu`

Not available when `NODE_ENV=production`. Used to demonstrate the auto-restart behavior.

- **Postman**: GET → URL `{{baseUrl}}/system/burn-cpu` → Params: `seconds` (default 10, max 60).
- **curl**:
  ```bash
  curl "{{baseUrl}}/system/burn-cpu?seconds=10"
  ```
- While this runs, poll `GET /api/system/cpu` (or watch the server console) — after CPU stays ≥ threshold for the configured number of samples, the console logs a restart and a new process ID appears.

## 6. Verifying data in MongoDB

Using MongoDB Compass or `mongosh`, connect to `MONGO_URI` and check these six collections after an upload: `agents`, `users`, `accounts`, `lobs`, `carriers`, `policies` — plus `scheduledmessages` and `messages` for the scheduler.

## 7. Assumptions

- "Username" in the search API refers to the sheet's `firstname` column (there is no dedicated username field in the source data).
- Users are de-duplicated by first name + email + date of birth, since the source sheet has no user ID column.
- CPU usage is measured as this Node process's share of one CPU core, sampled every second; the server restarts after 3 consecutive samples at or above the configured threshold (all tunable via `.env`).
- `day` in the scheduler accepts either a weekday name or an ISO date; `time` is 24-hour, interpreted in the server's local timezone.
- Scheduled messages are stored in MongoDB (not in memory) specifically so they are not lost if the CPU monitor restarts the server.
