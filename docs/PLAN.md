# Execution and acceptance checklist

- [ ] Separate independently installable backend and frontend projects.
- [ ] Registration, bcrypt login, expiring server-side sessions, logout.
- [ ] Every query and mutation scoped to the authenticated user.
- [ ] Reading create/list/update/delete; integer 40–600, four slots, unique user/date/slot, no future dates.
- [ ] Database constraints and concurrency tests protect duplicate submissions.
- [ ] Daily, month-to-date and previous-month reports; correct boundaries, one-decimal average, empty state.
- [ ] React + Tailwind UI; responsive, keyboard accessible; loading/error/empty/success states.
- [ ] Migrations, demo seed, environment examples, Docker Compose, setup and API docs.
- [ ] Backend integration tests against PostgreSQL; frontend and browser verification.
- [ ] Inspect desktop/mobile screenshots; regular Git commits; submission evidence.

## Architecture
Backend feature modules own routes, validation and database access. Shared infrastructure owns configuration, errors, authentication middleware and date calculations. Parameterized SQL stays visible and small; migrations enforce data integrity. The React client uses feature components, a single API client, and focused hooks. No global state framework is needed for this scope.

## Assumptions
Application timezone defaults to Asia/Kolkata and is configurable. Date-only values use YYYY-MM-DD throughout. A monthly report is the calendar month before the selected date. No readings means count 0 and null aggregates. Name max 80 characters, email max 254, passwords 8 characters minimum / 72 UTF-8 bytes maximum (bcrypt limit). A duplicate is a conflict; if all four slots are filled, a create reports the daily limit first. Public hosting and email submission are separate external actions.
