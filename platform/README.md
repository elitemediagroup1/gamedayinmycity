# GameDay Platform

The **GameDay Platform** is the platform-first backend powering GameDayInMyCity
and every future InMyCity property (CareInMyCity, PetsInMyCity, ServicesInMyCity,
SchoolsInMyCity, ...).

It is intentionally **not** sports-specific at its core. Sports are one domain
on top of a shared, multi-tenant foundation.

> This directory is the foundation delivered by the `platform-core-foundation`
> sprint (PR-A). The REST API, provider adapters, cache, Coach v1 and CMS
> service layers land in subsequent, sequenced PRs.

## Architecture at a glance

```
platform/
  api/         HTTP layer (Hono on Node) — added in PR-B
  database/    Postgres schema, migrations, seeds, client, health checks
  providers/   Provider adapters (SportsDataIO is provider #1) — PR-B
  services/    Domain service layers (CMS) — PR-C
  search/      Full-text / discovery — later
  auth/        Auth helpers — later
  cache/       Redis integration + graceful degradation — PR-B
  ai/          Coach v1 (grounded, non-fabricating) — PR-C
  shared/      Cross-cutting helpers
  config/      Typed, validated environment loader (zod)
  types/       Core types: tenancy, status, coverage, Loop events, API envelopes
  utils/       Slugs, pagination, response builders, retry/backoff
  tests/       Vitest suites
```

## Principles

1. **Platform-first.** Every table and API is tenant-scoped by `platform_id`.
2. **Honesty-first.** `coverage` distinguishes `live` from `rolling_out`. No
   fake data; Coach never fabricates.
3. **Loop-native.** Every high-intent action emits a `platform_events` row for
   the EMG Loop operating layer.
4. **Fail-closed config.** Missing required secrets stop startup with a clear
   error (see `config/`).
5. **Production-ready, not pseudocode.** Everything here typechecks and the
   pure logic is unit-tested in CI.

## Getting started

```bash
cd platform
cp .env.example .env        # then fill in real secrets (never commit .env)
npm install
npm run typecheck
npm run db:migrate
npm run db:seed
npm run health
npm test
```

## Tech stack

- **Runtime:** Node 20+, TypeScript (ESM, strict).
- **HTTP:** Hono (added in PR-B).
- **Database:** PostgreSQL via Supabase; `pg` pool + `@supabase/supabase-js`.
- **Validation:** zod.
- **Cache:** Redis via `ioredis` (optional; degrades gracefully).
- **Tests:** Vitest, with a Postgres service container in CI.

## Documentation

- `database/README.md` — schema, conventions, migrations, rollback policy.
- `../docs/ENVIRONMENT.md` — every environment variable.
- `../docs/DEPLOYMENT.md` — deploy + CI/CD.
- `../docs/DATABASE_README.md` — operational database reference.
