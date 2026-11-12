# Scalability and reliability work

This tracks the eight findings from the senior engineering review. Completion requires implementation and relevant verification; passing the original functional suite alone does not close these findings.

- [x] Consistent reading lock order and bounded transaction retries.
- [x] Atomic registration and session replacement; no session sweep on login.
- [x] Bounded password hashing away from the API main thread.
- [x] Shared authentication rate limits and explicit trusted-proxy configuration.
- [x] Database connection budgets, bounded admission and overload handling.
- [x] Batched maintenance/reminders with resumable progress and retention.
- [x] Reading-change synchronization and protection against outdated edits.
- [x] Timing/queue/pool visibility, bounded load checks and recovery/deployment procedures.

All regression fixtures must use disposable test schemas/prefixes. Demo data and shared services remain intact. The application remains a modular monolith.

## Verified: transaction correctness

The PostgreSQL suite passes 31 tests, including fault-injected session failures, preservation of an existing session after failed login replacement, a deterministic lock-order regression, overlapping edit/delete requests, retry rollback, retry exhaustion and no retry for arbitrary errors. Backend strict type checking and the production build pass. Registration/session replacement commit before cookies are sent; expired-session cleanup is removed from the login path and runs in batched maintenance.

## Verified: password work isolation

Password work runs on bounded Node worker threads, preserves bcrypt cost 12 and accepts existing hashes. The backend suite passes 34 tests, including compatibility, worker execution, queue overload/recovery and shutdown. A local four-hash check with two workers recorded a 21 ms maximum main-thread delay (16 ms p95), compared with 411 ms in the earlier main-thread baseline. This is a local diagnostic, not a production capacity claim.

## Verified: concurrency, multiple instances and bounded admission

The PostgreSQL/unit suite passes 41 tests, including simultaneous versioned edits, configuration budget checks, bounded/expired/disconnected request queues, protected metrics and draining readiness. Eight real Redis/BullMQ integration tests pass, including two API instances sharing an allowance, explicit proxy-client separation and a disconnected rate-limit client failing closed. Six desktop/mobile browser checks pass for cross-tab reading refresh, stale-edit rejection, preserving drafts, external updates via explicit refresh and concurrent submissions. Responsive account checks also pass at the existing audit widths. Migration 004 adds reading versions; existing clients must include the returned version in PUT requests.

Connection-budget validation uses declared maximum process counts, including deployment overlap. It does not discover replicas automatically; deployment configuration must keep those declarations accurate. Production capacity still requires measurement. Metrics/load/recovery and maintenance work remain open below.

## Verified: durable, bounded background work

Migration 005 adds one reminder checkpoint per date and a retention index. Reminder batches commit their event inserts and cursor together; retries resume from the last committed cursor. Integration checks interrupt a run, resume concurrently and verify exact counts without duplicates. Cleanup removes bounded batches of expired sessions and old reminder/checkpoint records, resumes on the next invocation, and preserves active sessions/readings. The Redis worker schedules cleanup hourly; PostgreSQL-only deployments can schedule `npm run maintenance:run --prefix backend`. Defaults are 500 rows/users per batch, 20 cleanup batches per invocation and 90-day reminder-log retention. Patient readings are not subject to that cleanup.

Protected worker metrics expose queue counts, database pool pressure and the latest aggregate checkpoint on loopback port 4002 when METRICS_TOKEN is configured. Scheduled jobs anchor their date to BullMQ's due time, preserving it across delayed execution/retries. Jobs older than reminder retention are skipped to prevent resurrecting pruned logs.

## Local workload baseline

`npm run bench:local --prefix backend` creates a disposable schema and its own loopback API. It cannot target a third-party server. The 306-request reading/report workload passed at 2, 5 and 10 concurrent synthetic users with four PostgreSQL connections and an active-request cap of eight. Observed client p95 latency was 55, 23 and 46 ms respectively; server errors were zero. These short local measurements do not establish a production capacity limit. JSON evidence is written to backend/.local/load-check.json and will be collected in CI.

Production startup/browser, backup/restore and restart recovery are now verified in GitHub Actions. Docker remains unavailable on the local Windows machine; the container evidence comes from the Ubuntu CI runner.

## Production CI feedback

The first container CI run passed the HTTPS browser workflow and full backup/restore content comparison, but failed the service-restart gate: the API was healthy inside its container while Nginx kept using its old address. The proxy now resolves API addresses dynamically through Docker DNS. The corrected recovery gate passed on the final rerun. Follow-up guards cover worker initialization failure, source-worker loading from different working directories, sanitized malformed Redis configuration and shared-limit readiness.

## Final completion evidence

[GitHub Actions run 43159420255](https://github.com/Yh010/sweety-glucose-tracker/actions/runs/43159420255) passed for runtime commit `801e2bce9e6e71173ad823e9d997cb1b1b50382a` on 12 November 2026:

- 45 backend tests, 10 PostgreSQL/Redis/BullMQ integration tests, 15 frontend tests and 40 desktop/mobile browser scenarios: 110 tests, no skips/failures.
- Backend/frontend builds, strict type checks, formatting and the isolated 306-request workload check passed.
- Production Docker images built and ran with migration/runtime roles separated. The HTTPS browser check verified redirect/security headers, secure HttpOnly cookies, signup, saving a reading, reports, CSV and logout.
- Backup/restore compared canonical digests across all six tables, reapplied runtime grants to the restored database and verified runtime-role access. CI also confirmed the runtime role cannot create schema objects, create roles/databases or inherit the owner role.
- The same HTTPS browser flow passed after restarting the API, worker, PostgreSQL, durable queue Redis and report-cache Redis. Dynamic proxy DNS resolved the changed API address.
- Worker queue/pool metrics passed. Locally, the maintenance CLI and a real BullMQ maintenance-job dispatch also passed. The refreshed local worker is running; the demo login/versioned-report smoke and temporary-schema cleanup checks passed.

All eight review findings have concrete implementations and verification. Documentation-only follow-up changes do not alter the runtime commit tested above. Public hosting, external monitoring/backup services, production traffic sizing and multi-host disaster recovery require the chosen deployment environment; they are not claimed by these local/CI checks.

The [retained CI workload data](evidence/load-check-ci.json) and [production screenshot](screenshots/production-desktop.png) are committed so evidence remains available after temporary Actions artifacts expire. The artifact uploader explicitly includes the selected hidden load-check path; no environment files or private certificate directories are included.

The final evidence run passed on commit `42b988b6f163f53e07d0c156719a5b616937a64a`; application runtime files are unchanged from `801e2bc`. Its downloaded artifact was inspected and contains the 306-request, zero-server-error load report.
