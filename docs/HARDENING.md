# Scalability and reliability work

This tracks the eight findings from the senior engineering review. Completion requires implementation and relevant verification; passing the original functional suite alone does not close these findings.

- [x] Consistent reading lock order and bounded transaction retries.
- [x] Atomic registration and session replacement; no session sweep on login.
- [ ] Bounded password hashing away from the API main thread.
- [ ] Shared authentication rate limits and explicit trusted-proxy configuration.
- [ ] Database connection budgets, bounded admission and overload handling.
- [ ] Batched maintenance/reminders with resumable progress and retention.
- [ ] Reading-change synchronization and protection against outdated edits.
- [ ] Timing/queue/pool visibility, bounded load checks and recovery/deployment procedures.

All regression fixtures must use disposable test schemas/prefixes. Demo data and shared services remain intact. The application remains a modular monolith.

## Verified: transaction correctness

The PostgreSQL suite passes 31 tests, including fault-injected session failures, preservation of an existing session after failed login replacement, a deterministic lock-order regression, overlapping edit/delete requests, retry rollback, retry exhaustion and no retry for arbitrary errors. Backend strict type checking and the production build pass. Registration/session replacement commit before cookies are sent; expired-session cleanup is removed from the login path and will run in batched maintenance.
