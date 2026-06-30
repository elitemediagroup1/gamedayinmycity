# API Reference — GameDay Platform (v1)

The GameDay Platform exposes a single, multi-tenant REST API that serves every
InMyCity property. Frontends consume this API exclusively; they never talk to
the database or third-party providers directly.

All endpoints live under the `/api` prefix and return a consistent typed
envelope.

## Tenancy

Every request is scoped to one InMyCity property (a *tenant*) via a platform id.
Resolution order:

1. `X-Platform-Id` request header
2. `platform` query string parameter
3. default tenant (`gameday`)

Valid platform ids: `gameday`, `care`, `pets`, `services`, `schools`.
An unknown id returns `400 tenant_invalid`.

## Response envelope

Success:

```json
{ "ok": true, "data": <payload>, "meta": { "page": 1, "per_page": 20, "total": 42, "total_pages": 3 } }
```

`meta` is present only on list endpoints. Error:

```json
{ "ok": false, "error": { "code": "validation_error", "message": "...", "details": { } } }
```

Error codes: `validation_error` (400), `tenant_invalid` (400), `not_found` (404),
`method_not_allowed` (405), `rate_limited` (429), `internal_error` (500).

## Shared list parameters

List endpoints accept:

| Param      | Type   | Default | Notes                                   |
| ---------- | ------ | ------- | --------------------------------------- |
| `page`     | int    | 1       | 1-based page number                     |
| `per_page` | int    | 20      | 1–100                                   |
| `status`   | enum   | —       | filter by entity status                 |
| `coverage` | enum   | —       | filter by coverage state                |
| `q`        | string | —       | full-text search (1–120 chars)          |

All list queries are tenant-scoped and exclude soft-deleted rows.

## Endpoints

### GET /api/health

Liveness + dependency readiness. Returns `200` when healthy, `503` when a
dependency (database) is down. Leaks no system, version, or environment detail.

```json
{ "ok": true, "data": { "status": "ok", "checks": { "api": "ok", "database": "ok" }, "loop_forwarding": false, "time": "2026-01-01T00:00:00.000Z" } }
```

### GET /api/sports

Lists sports for the tenant. Shared list params apply.

### GET /api/states

Lists states/regions. Shared list params apply. Includes a `code` field.

### GET /api/cities

Lists cities. Shared list params plus:

| Param   | Type   | Notes                                  |
| ------- | ------ | -------------------------------------- |
| `state` | string | scope to a state by its slug           |

### GET /api/articles

Lists editorial content, newest `published_at` first. Shared list params plus:

| Param  | Type   | Notes                         |
| ------ | ------ | ----------------------------- |
| `kind` | string | scope to an article kind      |

### POST /api/waitlist

Captures a waitlist signup and emits a native EMG Loop `waitlist_submit` event
(the DB write and event emission share one transaction). Idempotent per
`(platform_id, email)`.

Request body:

```json
{ "email": "person@example.com", "interest": "Basketball", "city": "newark", "session_id": "abc123" }
```

Only `email` is required. Response: `201` with `{ "id": "...", "email": "...", "status": "subscribed" }`.

## EMG Loop events

High-intent actions are recorded in the `platform_events` table so Loop can
ingest and route them. This release emits `waitlist_submit`. The full event
contract (coach_query, partner_lead, affiliate_click, search_query,
city_interest, sport_interest, live_stream_interest, form_submit, content_view)
is defined in the foundation schema and will be emitted by later releases.
