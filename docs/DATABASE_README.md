# Database — Operational Reference

This is the operations-facing database reference. The schema-level reference
(conventions, columns, triggers) lives next to the code in
`platform/database/README.md`.

## System of record

- **Engine:** PostgreSQL (managed by Supabase).
- **Model:** single shared schema, multi-tenant by `platform_id`.
- **Extensions:** `pgcrypto` (UUIDs), `pg_trgm` (trigram search).

## Tables (foundation, migration 0001)

| Table                  | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `platforms`            | Tenant registry (gameday, care, pets, services, ...) |
| `states`               | Geographic states, tenant-scoped                     |
| `cities`               | Cities, optionally linked to a state                 |
| `sports`               | Sport category hubs (GameDay domain)                 |
| `leagues`              | Leagues, linked to sport/city                        |
| `facilities`           | Venues (fields, courts, rinks, ...)                  |
| `articles`             | Articles + guides                                    |
| `partners`             | Partner organisations                                |
| `affiliate_categories` | Shop category hubs (honest, no fake prices)          |
| `waitlist`             | Waitlist signups (GameDay Live + general)            |
| `coach_queries`        | Logged Coach Q&A with grounding/audit flags          |
| `platform_events`      | EMG Loop event stream (all high-intent actions)      |
| `schema_migrations`    | Applied-migration ledger                             |

## Daily operations

```bash
npm run db:status     # which migrations are applied
npm run db:migrate    # apply pending migrations
npm run db:seed       # idempotent seed
npm run health        # dependency health (JSON report, exit 1 if down)
```

## Health checks

`npm run health` (and later `GET /api/health`) checks:

- **postgres** — `SELECT 1`.
- **migrations** — at least one applied version.
- **supabase** — service-role read of `platforms`.
- **redis** — `PING` if configured (`skipped` if not; `degraded` on failure).

Aggregate status is `down` if any hard dependency fails, `degraded` if only
optional ones do, otherwise `ok`.

## Backups & recovery

Database backups, point-in-time recovery, and disaster recovery are operated
through the Supabase project's backup features. Detailed runbooks
(`BACKUP_STRATEGY.md`, `DISASTER_RECOVERY.md`) are produced in the later
backend-hardening sprint. Until then, rely on Supabase automated daily backups
and enable PITR for production.

## Soft deletes

Rows are soft-deleted via `deleted_at`. All read queries filter
`deleted_at IS NULL`. Hard deletion is a deliberate, reviewed operation — never
performed automatically by the application.
