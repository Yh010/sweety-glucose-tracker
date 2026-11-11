# Verification record

Checked locally on 11 November 2026 with Node.js 24, PostgreSQL 18 (real embedded binaries), Google Chrome and Windows.

| Check | Evidence / result |
| --- | --- |
| Backend strict TypeScript and production build | Passed |
| Backend unit/integration tests | 25 passed; actual PostgreSQL, no skipped tests |
| Frontend unit/component tests | 9 passed |
| Browser journeys | 6 passed: desktop and mobile CRUD/validation/reports/logout/login, network recovery, session expiry |
| Production migration command | Passed, including replay of the applied migration |
| Demo seed | Validated in isolated schema; today and previous-month data, safe repeat, existing password preserved |
| Local PostgreSQL restart | Passed; 134 demo readings retained |
| Visual review | Desktop 1440px, mobile 390px; login, daily log, reports; images in screenshots/ |
| Automated accessibility | Zero WCAG A/AA violations in four captured states; details in accessibility.json |
| Browser console / horizontal overflow | No page errors or mobile horizontal overflow in screenshot run |
| Design review | Two material fixes scored resolved: helper contrast and visible daily-log measurement units |

The API suite verifies ownership on read/edit/delete/report paths, bcrypt hashing, session expiry/logout, required/numeric/range/date/slot validation, database constraints, duplicate races, four-reading limit under concurrency, conflicting edit rollback, pagination, report ranges (including year/leap boundaries), and one-decimal averages.

These results are scoped to the tested environment. Mobile is browser emulation, not physical-device testing. The Docker Compose configuration and GitHub Actions workflow are supplied but have not been executed here because Docker and a remote repository are not configured. No public deployment or repository publication has been performed.
