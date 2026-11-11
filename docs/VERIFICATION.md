# Verification record

Checked locally on 11 November 2026 with Node.js 24, PostgreSQL 18 (real embedded binaries), Google Chrome and Windows.

| Check | Evidence / result |
| --- | --- |
| Backend strict TypeScript and production build | Passed |
| Backend unit/integration tests | 25 passed; actual PostgreSQL, no skipped tests |
| Frontend unit/component tests | 9 passed |
| Browser journeys | 18 passed: desktop and mobile CRUD/validation/reports/logout/login, network recovery, session expiry, login/registration preservation across visibility changes |
| Production migration command | Passed, including replay of the applied migration |
| Demo seed | Validated in isolated schema; today and previous-month data, safe repeat, existing password preserved |
| Local PostgreSQL restart | Passed; 134 demo readings retained |
| Visual review | Desktop 1440px, mobile 390px; login, daily log, reports; images in screenshots/ |
| Automated accessibility | Zero WCAG A/AA violations in four captured states; details in accessibility.json |
| Browser console / horizontal overflow | No page errors or mobile horizontal overflow in screenshot run |
| Design review | Two material fixes scored resolved: helper contrast and visible daily-log measurement units |

The API suite verifies ownership on read/edit/delete/report paths, bcrypt hashing, session expiry/logout, required/numeric/range/date/slot validation, database constraints, duplicate races, four-reading limit under concurrency, conflicting edit rollback, pagination, report ranges (including year/leap boundaries), and one-decimal averages.

These results are scoped to the tested environment. Mobile is browser emulation, not physical-device testing. The public GitHub repository is published at https://github.com/Yh010/sweety-glucose-tracker. GitHub Actions passed for the previously pushed commit; the expanded QA changes are checked again after pushing. Docker Compose itself has not been run locally because Docker is unavailable. No public app deployment has been performed.

## Focus regression

Reproduced the login field reset before the fix: an unauthenticated profile query retried on visibility change, unmounted the form and cleared its uncontrolled fields. The regression failed with an empty email field on the original code. After the fix, desktop/mobile login and registration preserve all typed fields across a simulated 61-second absence and return, with no additional profile requests or logged-out metadata polling. All 10 browser tests, 9 frontend tests, production build and formatting check pass. Focus/reconnect refetching is disabled; successful writes still invalidate reports.

## Expanded end-to-end audit

See [the full QA report](E2E-QA.md). All 18 desktop/mobile browser tests passed against real PostgreSQL-backed APIs; 25 backend tests and 9 frontend tests also passed. Three reproduced bugs were fixed: deletion retry did not retry, the selected date remained editable during pending writes, and midnight metadata updates moved the selected day during data entry.
