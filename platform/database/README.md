# Platform Database

PostgreSQL (via Supabase) is the system of record for the GameDay Platform.
The schema is **platform-first and multi-tenant**: a single shared schema
serves every InMyCity property, with row-level scoping by `platform_id`.

## Conventions

Every domain table includes:

| Column        | Purpose                                              |
| ------------- | ---------------------------------------------------- |
| `id`          | uuid primary key (`gen_random_uuid()`)               |
| `platform_id` | tenant scope, FK to `platforms.platform_id`          |
| `slug`        | url-safe key, unique per `(platform_id, type)`       |
| `status`      | `draft` / `published` / `archived` / `pending`      |
| `coverage`    | `live` / `rolling_out` / `planned` / `paused`       |
| `source`      | provenance (`manual`, `sportsdataio`, `seed`, ...)  |
| `metadata`    | `jsonb`, default `{}`                                |
| `search`      | generated `tsvector` for full-text search            |
| `created_at`  | audit timestamp                                      |
| `updated_at`  | maintained by the `set_updated_at` trigger           |
| `deleted_at`  | soft delete (NULL = live row)                        |

Indexes are created per table for `platform_id`, common filters, and a GIN
index on `search`. Foreign keys cascade on tenant delete and `SET NULL` on
optional references.

## Multi-tenancy

`platform_id` is a stable slug (`gameday`, `care`, `pets`, `services`,
`schools`). The `platforms` table is the tenant registry. All reads and writes
must be scoped by `platform_id`; the service layer enforces this.

## EMG Loop events

`platform_events` captures every high-intent action across every property so
the Loop operating layer can ingest and route activity. Event types include
`waitlist_submit`, `coach_query`, `partner_lead`, `affiliate_click`,
`search_query`, `city_interest`, `sport_interest`, `live_stream_interest`,
`form_submit`, and `content_view`. Loop automation is intentionally **not**
implemented yet — only the native event contract.

## Migrations

Migrations are plain SQL in `migrations/NNNN_name.sql`, applied in filename
order and tracked in `schema_migrations`. Each file is idempotent.

```bash
npm run db:status     # show applied vs pending
npm run db:migrate    # apply pending migrations (up)
npm run db:rollback   # remove the latest ledger entry (see note below)
npm run db:seed       # idempotent seed (tenants + honest GameDay data)
npm run health        # run dependency health checks
```

### Rollback policy

`db:rollback` removes the **ledger entry** for the latest version but does
**not** auto-drop tables. Destructive rollbacks are deliberately manual: write
an explicit `NNNN_down.sql` and run it under review. This prevents accidental
data loss in shared, multi-tenant production data.

## Connecting

Connection strings come from validated env (see `../.env.example`):

- `DATABASE_URL` — pooled connection used by the API.
- `DIRECT_URL` — non-pooled connection used for migrations.

The pooled client lives in `client.ts` (`pgPool()`, `query()`,
`withTransaction()`). Always use parameterised queries (`$1, $2, ...`).
