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

For the second option keep that terminal running. Data stays in `backend/.local/postgres`; Ctrl+C stops the server. The bundled native binaries may require package-manager script approval. The launcher enables automatic symlink repair. If using an existing PostgreSQL server, create databases `sweety` and `sweety_test` and update both database URLs.

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

API tests use actual PostgreSQL, including simultaneous requests, database constraints, bcrypt, sessions, ownership, CRUD, validation, conflicting edits, pagination, boundaries and rounding. Frontend tests cover reading-form behavior and dates. Browser journeys exercise registration, CRUD, validation, reports, logout/login and network recovery on desktop/mobile.

Browser tests use Google Chrome by default and start the two servers if needed. Alternatively install Chromium from `frontend/` with `npx playwright install chromium` and set `PLAYWRIGHT_CHANNEL=chromium`. The GitHub workflow does this on Linux. Browser tests create synthetic accounts: use a disposable database outside local evaluation. Mobile tests emulate a phone viewport; physical-device testing remains future work.

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
    modules/reports/   Date-bounded SQL aggregation
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
- Default timezone: `Asia/Kolkata`, shown in the UI. Dates start at 1900 and cannot be future dates. Per-patient timezones are future work.
- All reading fields are editable. Conflicting edits roll back. Creating on a full day reports the daily limit first; other duplicates report the slot conflict. Updates exclude their own row from the count.
- For 15 October, month-to-date means 1-15 October; monthly means 1-30 September. Empty reports return zero count and null aggregates. Averages display one decimal.
- Charts show daily averages. Missing days have no point; lines connect recorded dates. Daily reports list every reading and slot.
- Bonuses: pagination, monthly chart, database Docker Compose, reading-form tests. Redis, BullMQ and doctor accounts remain future work.
- This journal records readings; it does not classify risk or recommend treatment.

### With more time

Password recovery, email verification, patient timezones, export, more device/browser coverage. Before real patient use: applicable privacy requirements, monitoring, backup/restore, retention and an audit trail. At higher traffic: a shared rate-limit store and scheduled session cleanup. Add report caching after measuring query cost. Current auth throttling is per process; configure Express proxy trust deliberately when deploying behind a trusted proxy.

## Production build

Build both projects with the commands above. From `backend/`, run `node dist/db/migrate-cli.js` once as a release step. Start with `npm start --prefix backend`; serve `frontend/dist` through a web server and proxy `/api` to the API on the same public origin. Use HTTPS, `NODE_ENV=production`, the exact public `APP_ORIGIN`, a private database and deployment-managed credentials. Add static security headers at the web server. Do not seed demo accounts in production. No live deployment is claimed.

## Submission

Use the public repository link and `docs/screenshots/` when replying to the hiring email. No real credentials, personal readings or assessment email are included. Publishing the repository and sending that email are separate steps.
