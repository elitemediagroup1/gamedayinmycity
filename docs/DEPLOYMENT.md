# Deployment

This document covers deploying the GameDay Platform backend and how it relates
to the existing GameDayInMyCity static site.

## Components

1. **Static site** (`/`, `index.html`, `css/`, `js/`, `data/`) — served today
   by GitHub Pages on the custom domain `gamedayinmycity.com`. **Unchanged by
   this sprint.**
2. **Platform backend** (`/platform`) — the Node/Hono API + Postgres schema.
   Deployed separately (it is not part of the static Pages build).

> PR-A delivers the foundation: schema, config, DB tooling, CI, docs. The HTTP
> server and routes arrive in PR-B; until then there is nothing to expose
> publicly, but everything here typechecks and migrates.

## Prerequisites

- A Supabase project (Postgres + service role key).
- Node 20+ on the deploy target (or a container runtime).
- Optional: a managed Redis instance for caching.

## One-time setup

```bash
cd platform
cp .env.example .env     # fill in real Supabase values (do NOT commit)
npm install
npm run db:migrate       # apply schema to the Supabase database
npm run db:seed          # seed tenant registry + honest GameDay data
npm run health           # verify Postgres + Supabase (+ Redis if configured)
```

## Building & running (after PR-B adds the server)

```bash
npm run build            # tsc -> dist/
npm start                # node dist/api/server.js
```

The API is stateless and horizontally scalable. Run multiple instances behind
a load balancer; all state lives in Postgres and (optionally) Redis.

## CI/CD

`.github/workflows/platform-ci.yml` runs on pushes/PRs touching `platform/`:

- **typecheck** — `npm run typecheck` (strict, no emit).
- **test** — spins up a Postgres 16 service container, applies migrations,
  seeds, and runs the Vitest suite.

CI uses throwaway container credentials, never production secrets.

## Promotion flow

1. Open a PR from a `platform-*` branch into `main`.
2. CI must be green (typecheck + tests).
3. Review, then squash-merge.
4. Deploy from `main` to the target environment.
5. Run `npm run db:migrate` against the environment's database as part of the
   release (migrations are idempotent and safe to re-run).

## Rollback

- **Code:** redeploy the previous build/commit.
- **Schema:** migrations are forward-only by default. To reverse a schema
  change, ship an explicit down migration under review (see
  `platform/database/README.md`). Never drop shared tenant tables ad hoc.

## Configuration & secrets

All configuration is environment-driven (see `ENVIRONMENT.md`). Provide secrets
through the host's secret manager. The service-role key and provider/Loop keys
are server-only.
