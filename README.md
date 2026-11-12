# Sweety

A private blood glucose journal for the Kenpath assessment. Record four meal-based readings per day and review daily, month-to-date and previous-month reports.

- `frontend/`: React, TypeScript, Tailwind, TanStack Query. No shadcn.
- `backend/`: Node.js, Express, TypeScript, PostgreSQL. No MongoDB.
- Each project installs, builds and runs independently.

## Local setup

Requires Node.js 22.12+ (tested on Node 24). From the repository root:

```sh
npm ci --prefix backend
npm ci --prefix frontend
```

Copy `backend/.env.example` to `backend/.env`. PowerShell: `Copy-Item backend/.env.example backend/.env`. macOS/Linux: `cp backend/.env.example backend/.env`.

Start PostgreSQL using **one** option:

```sh
# Docker: PostgreSQL 18, creates sweety and sweety_test on a new volume
docker compose up -d postgres
```

```sh
# No Docker/system installation: real PostgreSQL on loopback, development only
npm run db:local --prefix backend
```

For the second option keep that terminal running. New databases explicitly use UTF-8 so names in any language are supported. Data stays in `backend/.local/postgres`; Ctrl+C stops the server. The bundled native binaries may require package-manager script approval. The launcher enables automatic symlink repair. If using an existing PostgreSQL server, create databases `sweety` and `sweety_test` and update both database URLs.

In another terminal:

```sh
npm run db:migrate --prefix backend
npm run db:seed --prefix backend
npm run dev --prefix backend
```

In a third terminal:

```sh
npm run dev --prefix frontend
```

Open **http://localhost:5173**. Use this exact origin to match `APP_ORIGIN`; update that setting if you change the frontend host/port. Health: `http://localhost:4000/api/health`.

**Demo login:** `demo@sweety.local` / `SweetyDemo123!`. These are public local-evaluation credentials. All demo readings are synthetic. Seeding covers this month and the previous month; repeating it preserves an existing demo account and its data. `DEMO_EMAIL` and `DEMO_PASSWORD` are configurable.

No frontend environment variables are required. Vite proxies `/api` to port 4000. Fonts are bundled locally.

## Verification

Keep PostgreSQL running. API tests require a separate `TEST_DATABASE_URL` ending in `_test`; each run creates and removes only its own random schema.

```sh
npm run typecheck --prefix backend
npm run build --prefix backend
npm test --prefix backend
npm test --prefix frontend
npm run build --prefix frontend
npm run format:check --prefix frontend
npm run test:e2e --prefix frontend
```

API tests use actual PostgreSQL, including simultaneous requests, database constraints, bcrypt, sessions, ownership, CRUD, validation, conflicting edits, pagination, boundaries and rounding. Frontend tests cover reading-form behavior and dates. Browser journeys exercise registration, CRUD, validation, exact report calculations, logout/login, account switching, failed-write recovery, focus preservation and midnight updates on desktop/mobile. See [the end-to-end QA report](docs/E2E-QA.md).

Browser tests use Google Chrome by default and start dedicated servers on ports 5174/4001. They require TEST_DATABASE_URL ending in `_test`, create a random schema, and drop only that schema during teardown. They never reuse the demo servers or write to the demo database. Alternatively install Chromium from `frontend/` with `npx playwright install chromium` and set `PLAYWRIGHT_CHANNEL=chromium`. CI uses the Chrome already installed on the hosted Ubuntu runner. Browser tests create synthetic accounts in their own disposable schema. Their isolated API allows 1,000 authentication attempts per window; the normal app keeps its default limit of 30 attempts per IP per 15 minutes, verified by a separate integration test. Mobile tests emulate a phone viewport; physical-device testing remains future work.

With both servers running, `npm run review:ui --prefix frontend` regenerates demo screenshots and automated WCAG checks under `.impeccable/review/`. Submission screenshots are in `docs/screenshots/`.

## Structure

```text
backend/
  migrations/          SQL schema and constraints
  scripts/             Optional local PostgreSQL launcher
  src/
    config.ts          Validated environment
    app.ts             Express composition and middleware
    db/                Pool, migrations, demo seed
    lib/               Date calculations and errors
    modules/auth/      Registration and database-backed sessions
    modules/readings/  Validation, routes, transactional writes
    modules/reports/   Date-bounded SQL aggregation and CSV export
    modules/reminders/ Optional BullMQ jobs
    infrastructure/    Optional Redis report cache
  tests/               Unit and PostgreSQL integration tests
frontend/
  src/
    components/        Shell and shared controls
    features/auth/     Login and registration
    features/readings/ Daily log and reusable create/edit form
    features/reports/  Report controls, summary and chart
    lib/               Typed API client, dates and types
  e2e/                 Desktop/mobile browser journeys
```

## Design and scalability decisions

- One modular API with clear feature boundaries. No unnecessary services or queues.
- A unique `(user_id,date,slot)` constraint and four-value slot check cap each day at four readings. Integer/range constraints protect values.
- Creates/updates lock the owning user row inside a transaction. One patient's writes serialize; other patients write concurrently. Database uniqueness is the final guard.
- Reports use indexed user/date filters and SQL aggregates. Month responses contain at most 124 readings. The reading list is paginated, with limit capped at 100.
- bcrypt cost 12; opaque random tokens in HttpOnly/SameSite cookies; only token digests in PostgreSQL. Sessions expire after seven days; logout revokes them. Production cookies require HTTPS.
- Mutations require a custom header and an allowed origin when supplied; CORS is disabled. Parameterized SQL and session-derived user IDs prevent choosing another patient's data. Auth routes are throttled. Logs exclude bodies, cookies and query values.
- TanStack Query owns server data and invalidates reports after writes. Window focus and reconnect do not trigger fetches. Logged-out users have no metadata polling. Patient data is removed from the cache on logout/expiry. Form errors preserve entered values.
- Date-only strings stay dates through the driver and API. The server's configured timezone defines today. Report endpoints include both boundary dates.

## API

All routes start with `/api`. Mutations need JSON and `X-Requested-With: Sweety`. Authentication uses a session cookie. See [examples](docs/API.md).

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/auth/register`, `/auth/login`, `/auth/logout` | Account/session actions |
| GET | `/auth/me`, `/meta`, `/health` | Profile, timezone/date, readiness |
| GET | `/readings?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=20` | Paginated readings |
| POST | `/readings` | Create |
| PUT / DELETE | `/readings/:id` | Update / delete |
| GET | `/reports?date=YYYY-MM-DD&period=daily` | `daily`, `mtd`, `monthly` reports |

## Notes and assumptions

- PostgreSQL follows the explicit requirement despite the assignment's MERN title. No AI feature is required.
- Registration signs users in. Emails are normalized. Names: max 80 characters; emails: max 254; passwords: min eight characters and max 72 UTF-8 bytes (bcrypt limit).
- Default timezone: `Asia/Kolkata`, shown in the UI. Dates start at 1900 and cannot be future dates. Midnight updates preserve the selected day and draft; date navigation is locked during pending writes. Per-patient timezones are future work.
- All reading fields are editable. Conflicting edits roll back. Creating on a full day reports the daily limit first; other duplicates report the slot conflict. Updates exclude their own row from the count.
- For 15 October, month-to-date means 1-15 October; monthly means 1-30 September. Empty reports return zero count and null aggregates. Averages display one decimal.
- Charts show daily averages. Missing days have no point; lines connect recorded dates. Daily reports list every reading and slot.
- Bonuses: pagination, monthly chart, database Docker Compose, reading-form tests, Redis report caching and BullMQ daily reminder logs. Doctor accounts remain optional future work.
- This journal records readings; it does not classify risk or recommend treatment.

### With more time

Password recovery, email verification, patient timezones and more physical-device/browser coverage. Before real patient use: applicable privacy requirements, monitoring, backup/restore, retention and an audit trail. Shared rate limits, bounded password workers, request admission and scheduled session cleanup are implemented; deployment sizing still requires measured traffic. Benchmark the optional report cache and tune it from measured query costs. Current auth throttling is per process; configure Express proxy trust deliberately when deploying behind a trusted proxy.

## Production build

Build both projects with the commands above. From `backend/`, run `node dist/db/migrate-cli.js` once as a release step. Start with `npm start --prefix backend`; serve `frontend/dist` through a web server and proxy `/api` to the API on the same public origin. Use HTTPS, `NODE_ENV=production`, the exact public `APP_ORIGIN`, a private database and deployment-managed credentials. Add static security headers at the web server. Do not seed demo accounts in production. No live deployment is claimed.

## Submission

Use the public repository link and `docs/screenshots/` when replying to the hiring email. No real credentials, personal readings or assessment email are included. Publishing the repository and sending that email are separate steps.

## Report downloads and easier daily entry

Use **Download CSV** in Reports to save the selected report's individual readings. The export has date, meal slot and glucose in mg/dl, uses the displayed date range, and includes only the signed-in patient's data. Empty reports disable the download. CSV is useful for bringing a record to an appointment; the app does not send it to anyone.

The form suggests the next unfilled slot. Completing all four entries shows a clear status and prevents an unnecessary fifth submission; the date field stays usable so a patient can record another day. Historical dates have a **Today** shortcut. Refreshed suggestions never replace a typed draft.

## Optional Redis cache and reminder worker

The app still runs entirely on PostgreSQL when REDIS_URL is omitted. To enable both extras with Docker:

```sh
docker compose --profile extras up -d
```

If a Redis-compatible service is already installed, use that instead. Set REDIS_URL=redis://127.0.0.1:6379 in backend/.env, apply migrations and restart the API. Redis 6.2+ is required by BullMQ; Compose supplies Redis 7. Use noeviction for queue storage. The Compose Redis volume enables append-only persistence.

**Report caching:** reading creates, edits and deletes bump a patient-specific version in the same PostgreSQL transaction. Cached responses are keyed by patient, version, period and date. Old requests cannot repopulate the current version after a write. Old keys expire after ten minutes to bound storage; this retention timer does not make reports stale. Redis errors and malformed cache records fall back to PostgreSQL. A date-leading index supports the worker's across-patient scan. Reading writes should go through the API so version invalidation is applied.

**Reminder logging:** start the optional process in another terminal:

```sh
npm run worker --prefix backend
```

It installs one BullMQ scheduler at REMINDER_HOUR (default 21:00) in APP_TIMEZONE. Patients with fewer than four entries get one reminder_events row per date. Database uniqueness makes retries safe. Logs contain only the date and aggregate count, without names, emails, patient IDs or reading values. This is the assignment's background reminder-log bonus: it does not send notifications or email. Jobs retry three times with exponential backoff; completed and failed job retention is bounded.

To enqueue an immediate local demonstration while the worker is running:

```sh
npm run reminders:run --prefix backend
```

Production workers use npm run worker:start after the backend build. Multiple worker instances share a stable scheduler ID, and the database prevents duplicate reminder rows. Use separate Redis databases/instances per deployment environment.

To test these extras against real PostgreSQL and Redis, set TEST_REDIS_URL (or REDIS_URL), then run:

```sh
npm run test:extras --prefix backend
```

This suite uses a random database schema and Redis key prefix and removes only its own data. It verifies caching, patient isolation, create/edit/delete invalidation, late old cache writes, Redis disconnection fallback, CSV bytes, reminder idempotency, a real BullMQ job and timezone-aware scheduling. CI runs it against PostgreSQL 18 and Redis 7.

## Reliability and deployment hardening

The [hardening evidence](docs/HARDENING.md) tracks the senior review and its regression tests. Registration/session replacement are atomic; reading writes use consistent lock order and bounded transaction retries. PUT requests require a record version, preventing stale edits from overwriting newer values. Cross-tab reading updates preserve typed drafts; explicit refresh supports other devices without reloading forms on focus.

Password hashing runs on bounded worker threads. Multiple API processes require shared Redis authentication limits and explicit trusted proxies. Configured process pools must fit a declared PostgreSQL connection budget; per-process request queues are bounded. Reminder work checkpoints each batch, and cleanup removes expired sessions/old reminder logs without deleting patient readings.

See [deployment and recovery](docs/OPERATIONS.md) for the production Compose setup, independent database roles, HTTPS, metrics, connection budgets, maintenance, backup/restore and coordinated rollback. The production container checks run in GitHub Actions because Docker is unavailable on the local Windows machine. A public production deployment is a separate action.

```sh
npm run bench:local --prefix backend
```

The bounded workload check uses a disposable database schema and its own loopback API; JSON evidence is written to backend/.local/load-check.json. It is a local/CI regression baseline, not a production user-capacity guarantee.
