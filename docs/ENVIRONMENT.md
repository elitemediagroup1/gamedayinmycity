# Environment Variables

The GameDay Platform reads all configuration from environment variables,
validated at startup by `platform/config` (zod). Copy `platform/.env.example`
to `platform/.env` and fill in real values. **Never commit a real `.env`.**

Missing or invalid **required** variables cause a fast, explicit startup error
listing every problem (fail-closed).

## Runtime

| Variable    | Required | Default       | Notes                              |
| ----------- | -------- | ------------- | ---------------------------------- |
| `NODE_ENV`  | no       | `development` | `development` / `test` / `production` |
| `PORT`      | no       | `8787`        | API listen port                    |
| `LOG_LEVEL` | no       | `info`        | `debug` / `info` / `warn` / `error`  |

## Supabase / Postgres (required)

| Variable                    | Required | Notes                                            |
| --------------------------- | -------- | ------------------------------------------------ |
| `DATABASE_URL`              | yes      | Pooled connection used by the API.               |
| `DIRECT_URL`                | no       | Non-pooled connection used for migrations.       |
| `SUPABASE_URL`              | yes      | Project URL.                                     |
| `SUPABASE_ANON_KEY`         | yes      | Public anon key.                                 |
| `SUPABASE_SERVICE_ROLE_KEY` | yes      | **Server-only.** Never ship to any frontend.     |

Find these in the Supabase dashboard under Project Settings -> Database and
Project Settings -> API.

## Redis cache (optional)

| Variable                    | Required | Default | Notes                                  |
| --------------------------- | -------- | ------- | -------------------------------------- |
| `REDIS_URL`                 | no       | (unset) | If unset, caching is disabled.         |
| `CACHE_ENABLED`             | no       | `true`  | Master switch; needs `REDIS_URL` too.  |
| `CACHE_DEFAULT_TTL_SECONDS` | no       | `300`   | Default TTL for cached entries.        |

The platform **degrades gracefully** without Redis: on cache miss or outage it
falls back to the database. A Redis failure is reported as `degraded`, not
`down`, by the health checks.

## Providers (optional until enabled)

| Variable                | Required | Default                        |
| ----------------------- | -------- | ------------------------------ |
| `SPORTSDATAIO_API_KEY`  | no       | (unset)                        |
| `SPORTSDATAIO_BASE_URL` | no       | `https://api.sportsdata.io/v3` |

SportsDataIO is provider #1. The frontend never calls providers directly; all
provider access is mediated by the platform's provider adapters and cache.

## EMG Loop (operating layer)

| Variable          | Required | Default | Notes                                  |
| ----------------- | -------- | ------- | -------------------------------------- |
| `LOOP_ENABLED`    | no       | `true`  | Emit `platform_events` for Loop.       |
| `LOOP_INGEST_URL` | no       | (unset) | Loop ingest endpoint (later phase).    |
| `LOOP_API_KEY`    | no       | (unset) | Loop auth (later phase).               |

Even with `LOOP_ENABLED=false`, events are still written to `platform_events`;
the flag only governs outbound routing to Loop, which is not implemented yet.

## Secrets handling

- Secrets live only in `.env` (local) or the host's secret manager (prod).
- CI uses **throwaway** credentials for an ephemeral Postgres container; these
  are not production secrets (see `.github/workflows/platform-ci.yml`).
- The service-role key and any provider/Loop keys are server-only and must
  never appear in client bundles, URLs, or logs.
