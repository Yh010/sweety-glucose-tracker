# Execution and acceptance checklist

- [x] Separate independently installable backend and frontend projects.
- [x] Registration, bcrypt login, expiring server-side sessions, logout.
- [x] Every query and mutation scoped to the authenticated user.
- [x] Reading create/list/update/delete; integer 40–600, four slots, unique user/date/slot, no future dates.
- [x] Database constraints and concurrency tests protect duplicate submissions.
- [x] Daily, month-to-date and previous-month reports; correct boundaries, one-decimal average, empty state.
- [x] React + Tailwind UI; responsive, keyboard accessible; loading/error/empty/success states.
- [x] Migrations, demo seed, environment examples, Docker Compose, setup and API docs.
- [x] Backend integration tests against PostgreSQL; frontend and browser verification.
- [x] Inspect desktop/mobile screenshots and browser walkthroughs.

## Architecture

Backend feature modules own routes, validation and database access. Shared infrastructure owns configuration, errors, authentication middleware and date calculations. Parameterized SQL stays visible and small; migrations enforce data integrity. The React client uses feature components, a single API client, and focused hooks. No global state framework is needed for this scope.

## Assumptions

Application timezone defaults to Asia/Kolkata and is configurable. Date-only values use YYYY-MM-DD throughout. A monthly report is the calendar month before the selected date. No readings means count 0 and null aggregates. Name max 80 characters, email max 254, passwords 8 characters minimum / 72 UTF-8 bytes maximum (bcrypt limit). A duplicate is a conflict; if all four slots are filled, a create reports the daily limit first.

## Bonus milestone

- [x] Optional Redis report cache with transactionally versioned invalidation.
- [x] BullMQ incomplete-day logging, timezone schedule, retries and database deduplication.
- [x] Patient-scoped CSV export with browser download tests.
- [x] Next unfilled slot, complete-day recovery and Today shortcut.
- [x] Real Redis/worker integration tests and desktop/mobile regressions.
- [ ] Optional doctor accounts and assigned-patient reports (outside this milestone).
