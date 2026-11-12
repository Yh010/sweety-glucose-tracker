# Deployment and recovery

The production Compose file runs the compiled API/worker, built React files behind an HTTPS Nginx proxy, PostgreSQL, durable queue Redis and a separate evictable report cache. The smaller public demo runs on Render; see [its deployment configuration](RENDER.md) for the differences. The container, browser, backup/restore and restart checks passed in [CI run 43159420255](https://github.com/Yh010/sweety-glucose-tracker/actions/runs/43159420255).

## Configure and start

Requires Docker Compose v2. Run from the repository root:

```sh
node deploy/generate-env.mjs
```

This writes an ignored deploy/.env.local with four independent random hex secrets and refuses to overwrite an existing file. Restrict access to it; use a deployment secret manager for a public installation. Do not commit secrets, certificates, keys or backups. The migration and runtime passwords must remain URL-safe hex because Compose constructs database URLs from them. Generating a different environment file does not rotate passwords in an existing PostgreSQL volume; coordinate database credential rotation separately.

Put your TLS certificate and private key in deploy/certs/tls.crt and deploy/certs/tls.key. Use a trusted certificate for a public domain. CI uses a temporary self-signed certificate solely for its local HTTPS check. The browser check's certificate exception is restricted to localhost and is not an application setting.

Set APP_ORIGIN to the exact HTTPS origin, without a trailing slash. Defaults bind only localhost:8443; public hosting requires a deliberate bind address, public ports, DNS, a valid certificate and host firewall configuration. Change SWEETY_SUBNET/SWEETY_PROXY_IP if that Docker network conflicts with an existing network. Only that proxy IP is trusted; do not use blanket proxy trust.

```sh
docker compose --env-file deploy/.env.local -p sweety -f compose.production.yaml build
docker compose --env-file deploy/.env.local -p sweety -f compose.production.yaml up -d
docker compose --env-file deploy/.env.local -p sweety -f compose.production.yaml ps
```

PostgreSQL initializes separate owner and runtime roles. The one-shot migration service uses the owner; the API and worker use a non-superuser runtime role with data access only. Startup waits for migrations and grants. Database and Redis ports are not published. Backend containers run as the Node user. Queue Redis has persistence/no eviction; report-cache Redis has a separate memory budget and eviction. A cache outage falls back to PostgreSQL.

Use tagged images for a release: set SWEETY_IMAGE_TAG to a commit SHA before building. Keep the prior images and the matching source checkout for rollback. CI builds and checks the containers; provision the target infrastructure before deploying them.

## Size the deployment

Set API_PROCESSES and WORKER_PROCESSES to the **maximum simultaneous process counts**, including rollout overlap, not only steady-state replicas. Startup rejects a declared configuration unless:

```text
API_PROCESSES * DB_POOL_SIZE
+ WORKER_PROCESSES * DB_WORKER_POOL_SIZE
+ DB_RESERVED_CONNECTIONS <= DB_CONNECTION_BUDGET
```

Budget must fit the actual PostgreSQL connection allowance after other applications/administration are accounted for. Validation uses your declarations; it does not discover replicas or coordinate an autoscaler. Use a shared external connection pool when a larger fleet needs one global connection cap. Multiple API processes require the same RATE_LIMIT_REDIS_URL/prefix, configured by production Compose. Changing those settings on only one replica splits the allowance.

Per process, API_MAX_CONCURRENT/API_MAX_QUEUED/API_QUEUE_WAIT_MS bound request work; extra requests receive 503 and Retry-After. Password hashing has its own HASH_WORKERS/HASH_QUEUE_LIMIT budget. Size worker threads to allocated CPU, measure under representative traffic and keep password cost 12. A cache hit still needs PostgreSQL authentication/version queries.

The API is intentionally a modular monolith. Reports are bounded to a maximum of 124 readings; sharding and microservices are not prerequisites. Large-history OFFSET pagination can be replaced with cursors when measured history-query costs justify it.

## Observe and maintain

GET /api/live indicates process liveness; GET /api/health checks PostgreSQL and any configured shared authentication-limit store, and fails while draining. Optional report-cache availability does not block readiness. Use readiness to remove traffic; do not use a database-dependent readiness failure as the only reason to restart every API process.

GET /internal/metrics requires the METRICS_TOKEN bearer secret and exposes aggregate request timing, a bounded recent p95 sample, admission pressure, database waiting and password-worker utilization. Worker metrics use the same authorization on loopback port 4002 inside the worker container and add queue counts/checkpoint progress. Access them through an authenticated local collector or administrative container exec; the port is not published. Never log the bearer token.

Collect and alert on sustained 503 rates, growing request/database queues, latency versus your chosen service target, failed jobs, old unfinished reminder runs, Redis memory/disk usage and backup age. Existing request IDs and sanitized database error codes correlate failures without recording glucose values or credentials. JSON snapshots are building blocks for a collector, not a hosted monitoring service.

The worker schedules maintenance hourly. It removes expired sessions and reminder logs/checkpoints older than REMINDER_RETENTION_DAYS (default 90), using bounded batches. Patient readings are preserved. A PostgreSQL-only deployment can schedule this command hourly using its operating system scheduler:

```sh
npm run maintenance:run --prefix backend
```

Defaults: 500 rows/users per batch, at most 20 cleanup batches per invocation, and a separate two-connection worker pool. A `more: true` maintenance result means another bounded invocation is needed. Reminder batches save progress atomically with inserted events, so retries resume instead of repeating the full population. Completed runs use a cohort anchored at start time; accounts created later are considered on the next day's run.

## Back up and restore

The commands below use a Bash-compatible shell for binary redirection; older PowerShell versions can corrupt redirected binary output. Store backups on restricted storage, encrypt them through your approved backup system and keep copies outside the application host. A local Docker volume alone is not a backup.

```sh
umask 077
mkdir -p backups
docker compose --env-file deploy/.env.local -p sweety -f compose.production.yaml exec -T postgres pg_dump -U sweety_owner -Fc sweety > backups/sweety.dump
docker compose --env-file deploy/.env.local -p sweety -f compose.production.yaml exec -T postgres createdb -U postgres -O sweety_owner sweety_restore_check
docker compose --env-file deploy/.env.local -p sweety -f compose.production.yaml exec -T postgres pg_restore -U sweety_owner --no-owner --no-acl --exit-on-error -d sweety_restore_check < backups/sweety.dump
```

Restore into a new database first; createdb refuses an existing name. Verify records and constraints there before changing any application URL. Reapply runtime grants using the deployment migration command with its DATABASE_URL pointed at the restored database. Do not compare a live, changing source database to an older snapshot and call every difference a restoration failure. CI pauses background writes and compares canonical content digests of all six tables between source and restored snapshots, then verifies runtime-role access.

For recovery, keep traffic paused while selecting the verified restored database and applying grants. Before allowing reads from an older snapshot, clear the dedicated report-cache database with `docker compose --env-file deploy/.env.local -p sweety -f compose.production.yaml exec -T cache redis-cli FLUSHDB`; restored version counters can otherwise reuse cache keys from a later database state. This command targets only the separate evictable `cache` service, never the durable queue Redis. Reopen browser views after cutover and check login/CRUD/reports. Resume traffic after readiness and a smoke check pass. Never drop the current database as the first recovery step. Define and measure acceptable data loss and recovery time before real usage; a successful small CI restore does not establish those targets for a large database.

## Roll out and roll back

1. Take and verify a backup. Record current image tags and migration versions.
2. Plan a write pause for this assessment deployment. Upgrade the API and matching frontend together because PUT now requires a reading version. Open browsers should reopen the app after deployment; do not silently discard unsaved drafts.
3. Build the new tagged images, run Compose startup/migrations and check readiness. Migrations 004/005 are additive; never edit applied migration files.
4. The proxy refreshes API addresses through Docker DNS with a five-second cache. Reload Nginx only if proxy configuration changes: `docker compose --env-file deploy/.env.local -p sweety -f compose.production.yaml exec frontend nginx -s reload`. The restart regression specifically checks that no manual reload is needed after API/data-service restarts.
5. Smoke-test signup/login, a reading, reports, export and worker metrics before resuming normal writes.
6. If rollback is needed, restore the previous API/frontend image tags together from the recorded checkout and start those services again. Keep compatible additive database changes. For a future incompatible migration, pause and use its explicit recovery plan; do not automatically run destructive down-migrations.

CI exercises the compiled application over HTTPS, secure cookies, normal browser use, a full database backup/restore into a separate database, runtime grants and application/data-service restarts. It uses only synthetic records and a disposable Docker project. It does not publish the app or prove multi-host failover.
