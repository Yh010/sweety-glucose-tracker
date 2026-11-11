# End-to-end QA report

Tested on 11 November 2026 with Google Chrome, Node.js 24, Express, PostgreSQL 18 and a real Redis-compatible server on Windows. CI runs the same suites with PostgreSQL 18 and Redis 7 on Ubuntu.

## Results

| Check | Result |
| --- | --- |
| Desktop browser scenarios | 18 passed |
| Mobile browser scenarios | 18 passed |
| Backend unit/integration tests | 26 passed |
| Redis/BullMQ/CSV integration tests | 7 passed |
| Frontend unit/component tests | 15 passed |
| Backend/frontend production builds and strict type checks | Passed |
| Automated accessibility checks in browser flows | Zero violations |
| Responsive widths | No horizontal overflow at 320, 390, 768 and 1440 pixels |

The browser suite runs against dedicated servers on ports 5174/4001 and a random schema in TEST_DATABASE_URL. It never reuses the demo servers. A random token authorizes shutdown of these test-only servers; teardown removes only its validated schema. No shutdown endpoint is included in the application server or production build. The isolated browser API permits 1,000 authentication attempts per window; the normal app retains 30 attempts per IP per 15 minutes. An integration test independently verifies throttling and Retry-After without blocking health/profile reads.

## Gaps addressed in this audit

| Finding | Correction and verification |
| --- | --- |
| Logout in one tab leaves another showing patient data | Explicit authentication changes signal other tabs, clear patient caches and recheck the session. Ordinary tab focus does not reload the page or reset form inputs |
| A request that never finishes leaves Saving active indefinitely | Requests abort after 20 seconds; the form becomes usable and keeps its draft. Browser clock testing confirms recovery and a subsequent successful save |
| A save commits but its response is lost, leaving the log stale | Failed writes refresh reports while retaining inputs; retries show the existing slot instead of creating duplicate records |
| A deletion commits but its response is lost | Failed deletion refreshes the journal; retry treats an already absent reading as successful deletion |
| A delayed response from a previous session affects the current session | Session generations prevent late old 401 responses from expiring a new session and discard exports that finish after an account change |
| Valid JSON with an invalid cached report shape reaches the browser | Runtime validation rejects malformed cache records and rebuilds reports from PostgreSQL |
| Windows local database encoding rejects Unicode names | Local database initialization and creation explicitly use UTF-8. The existing local journal was copied to UTF-8 databases with all account/session/reading/reminder row counts verified; original databases were retained |

Earlier regression checks remain: deletion retry actually retries, pending writes lock date navigation, midnight metadata updates preserve the chosen day and draft, and generated test HTML does not reload the login page.

## Coverage

- Accounts: registration/login, duplicate case-insensitive email, incorrect credentials, password visibility and UTF-8 byte limit, retained fields after failure, logout/relogin, session expiry, ownership and account switching, cross-tab logout, authentication throttling.
- Readings: required/invalid/nonnumeric/fractional/out-of-range inputs, inclusive 40/600 boundaries, valid slots, invalid calendar/future dates, all four slots and fifth-entry prevention, duplicate and concurrent submissions, keyboard submission, edit conflicts, moving dates, cancellation, confirmed deletion and deletion retry.
- Recovery: failed reads/retry, rejected saves, drafts during background metadata errors and midnight changes, delayed writes, connection loss after a save/delete commits, stalled saves, old-session responses, failed CSV download/retry.
- Reports: slot ordering, exact count/min/max/one-decimal average, daily/MTD/full previous month, excluded dates, leap years, December/January boundaries, empty reports and chart rendering.
- Capacity: a complete 31-day month retains all 124 readings in reports and CSV; pagination returns 100 plus 24 distinct entries without truncation.
- Extras: per-patient versioned cache, bounded retention, create/edit/delete invalidation, late old cache writes, malformed JSON and malformed report shapes, fallback with a disconnected optional cache, CSV BOM/CRLF/range/ownership/empty exports, actual BullMQ processing, timezone scheduling, reminder deduplication and complete-day exclusion.
- UX: next-slot suggestions, draft preservation, full-day guidance, date entry on complete days, Today shortcut, export loading controls, Unicode/long names, responsive bounds, automated accessibility checks, login/registration drafts across background/foreground transitions without additional profile requests.

## Re-run

Keep PostgreSQL running and configure TEST_DATABASE_URL to a disposable database ending in `_test`. Configure TEST_REDIS_URL or REDIS_URL for extras tests.

```sh
npm test --prefix backend
npm run test:extras --prefix backend
npm test --prefix frontend
npm run test:e2e --prefix frontend
npm run typecheck --prefix backend
npm run build --prefix backend
npm run build --prefix frontend
npm run format:check --prefix frontend
```

Playwright writes frontend/playwright-report and frontend/test-results (ignored by Git). GitHub Actions uploads them as the browser-results artifact on success and failure. Only synthetic accounts are used. Backend tests and extras tests use their own random schemas and Redis prefixes.

## Limits

Mobile coverage is Chromium phone emulation, not a physical iPhone or Safari. Firefox and WebKit are untested. Automated accessibility checks do not replace manual screen-reader review. Docker Compose was not run locally because Docker is unavailable. No public deployment, multi-instance failover, production-scale load benchmark or live PostgreSQL/Redis service restart was tested. Cache disconnection and browser request failures were exercised without stopping shared services. These checks establish behavior in the tested scope, not proof that every possible defect is absent.
