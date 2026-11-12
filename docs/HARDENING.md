# Scalability and reliability work

This tracks the eight findings from the senior engineering review. Completion requires implementation and relevant verification; passing the original functional suite alone does not close these findings.

- [x] Consistent reading lock order and bounded transaction retries.
- [x] Atomic registration and session replacement; no session sweep on login.
- [x] Bounded password hashing away from the API main thread.
- [x] Shared authentication rate limits and explicit trusted-proxy configuration.
- [x] Database connection budgets, bounded admission and overload handling.
- [ ] Batched maintenance/reminders with resumable progress and retention.
- [x] Reading-change synchronization and protection against outdated edits.
- [ ] Timing/queue/pool visibility, bounded load checks and recovery/deployment procedures.

All regression fixtures must use disposable test schemas/prefixes. Demo data and shared services remain intact. The application remains a modular monolith.

## Verified: transaction correctness

The PostgreSQL suite passes 31 tests, including fault-injected session failures, preservation of an existing session after failed login replacement, a deterministic lock-order regression, overlapping edit/delete requests, retry rollback, retry exhaustion and no retry for arbitrary errors. Backend strict type checking and the production build pass. Registration/session replacement commit before cookies are sent; expired-session cleanup is removed from the login path and will run in batched maintenance.

## Verified: password work isolation

Password work runs on bounded Node worker threads, preserves bcrypt cost 12 and accepts existing hashes. The backend suite passes 34 tests, including compatibility, worker execution, queue overload/recovery and shutdown. A local four-hash check with two workers recorded a 21 ms maximum main-thread delay (16 ms p95), compared with 411 ms in the earlier main-thread baseline. This is a local diagnostic, not a production capacity claim.

## Verified: concurrency, multiple instances and bounded admission

The PostgreSQL/unit suite passes 41 tests, including simultaneous versioned edits, configuration budget checks, bounded/expired/disconnected request queues, protected metrics and draining readiness. Eight real Redis/BullMQ integration tests pass, including two API instances sharing an allowance, explicit proxy-client separation and a disconnected rate-limit client failing closed. Six desktop/mobile browser checks pass for cross-tab reading refresh, stale-edit rejection, preserving drafts, external updates via explicit refresh and concurrent submissions. Responsive account checks also pass at the existing audit widths. Migration 004 adds reading versions; existing clients must include the returned version in PUT requests.

Connection-budget validation uses declared maximum process counts, including deployment overlap. It does not discover replicas automatically; deployment configuration must keep those declarations accurate. Production capacity still requires measurement. Metrics/load/recovery and maintenance work remain open below.
