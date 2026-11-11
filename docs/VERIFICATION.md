# Verification

Checked on 11 November 2026 with Node.js 24, PostgreSQL 18, a real Redis-compatible server and Chrome on Windows.

| Check | Result |
| --- | --- |
| Backend unit/API tests | 26 passed against PostgreSQL; no skips |
| Optional cache/queue/CSV integration | 7 passed |
| Frontend unit/component tests | 15 passed |
| Browser suite | 36 passed across desktop and phone emulation |
| Production builds and strict type checking | Passed |
| Formatting | Passed |

See [the detailed QA report](E2E-QA.md) for findings, corrections, coverage, rerun commands and limitations. Browser tests use a random schema in the disposable test database and dedicated servers; normal demo data is preserved. The browser harness and cleanup scripts are included in strict type checks.

The local Windows database encoding issue was corrected using UTF-8 databases. Existing data was preserved: 70 accounts, 82 sessions, 291 readings and 59 reminder events at migration time. Original databases were retained. The development API and reminder worker use the UTF-8 database. A demo API login/report smoke check also passed after the switch.

CI runs real PostgreSQL 18 and Redis 7 plus the browser tests. GitHub Actions results for the current commit should be checked after pushing. No public deployment, physical-device test or production load benchmark has been performed. Docker Compose is provided but has not been run locally.
