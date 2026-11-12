# Render assessment demo

The root `render.yaml` creates a free Node web service and a free PostgreSQL database in Singapore. The Node process serves the compiled React app and `/api` on the same HTTPS origin. Render's own `RENDER_EXTERNAL_URL` supplies the allowed form origin. Database access uses the private connection string; external database access is disabled.

Render runs the locked dependency install and both production builds. Startup applies checksum-verified migrations under a PostgreSQL advisory lock before accepting traffic. Database credentials and the generated metrics token stay in Render environment variables.

This is a single-process assessment demo. Authentication throttles are process-local, and Redis caching and scheduled reminder workers are disabled. Do not increase the API process count without shared Redis rate limiting. For persistent operation, backups, dedicated migration credentials, workers, and horizontal scaling, use the production setup in `OPERATIONS.md`.

Free web services sleep after 15 minutes without traffic, so the first request can take longer. Free PostgreSQL expires 30 days after creation. Back up any data before expiry. Use synthetic readings for the public assessment demo.

No demo account is silently inserted into production. Reviewers can register through the app. The local development seed remains available separately.

Deploy through Render's **New > Blueprint**, connect the public GitHub repository, select `main`, and review that both resources show **Free** before deploying. No payment method or paid upgrade is needed for this configuration.

Sources: [Render free instances](https://render.com/docs/free), [Blueprint specification](https://render.com/docs/blueprint-spec).
