# Observability

How the Loop event platform exposes its health and behaviour.

## Structured logging

Every delivery attempt emits one structured, single-line JSON log record
(`scope: events.queue`) so log aggregators can parse every field. Each record
includes:

| Field | Meaning |
| --- | --- |
| `event_id` | The event being delivered. |
| `event_type` | Canonical type. |
| `trace_id` | Logical request/flow id. |
| `correlation_id` | Related-event chain id. |
| `status` | `delivered` \| `retrying` \| `dead_lettered`. |
| `attempt` | 1-based attempt number. |
| `processing_ms` | Wall-clock time for the attempt. |
| `error` | Failure message (on retry/dead-letter only). |

The logger is injectable (`EventLogger`), so the default `console` sink can be
swapped for a real logging backend without touching delivery logic.

## Metrics

The queue maintains a live snapshot:

- `depth` — events waiting to be processed.
- `in_flight` — events currently being delivered.
- `delivered`, `retried`, `failed`, `dead_lettered` — running counters.
- `last_publish_at`, `last_retry_at` — ISO timestamps of the most recent events.
- `running` — whether the background drain loop is active.

## Health endpoint

```
GET /api/events/health
```

Returns a `200` envelope whose `data` reports:

```json
{
  "status": "ok",
  "queue": {
    "depth": 0,
    "in_flight": 0,
    "delivered": 0,
    "retried": 0,
    "failed": 0,
    "dead_lettered": 0,
    "last_publish_at": null,
    "last_retry_at": null,
    "running": false
  },
  "checks": { "database": "ok", "loop_adapter": "ok" },
  "loop_forwarding": true,
  "adapter": "database",
  "time": "..."
}
```

`status` is `degraded` when either the database or the Loop adapter probe
fails. The endpoint deliberately leaks no system, version, or environment
details to the client.

## Tracing

`trace_id` and `correlation_id` are generated at event creation when not
supplied. Producers that already have a trace context should pass it through so
events stitch into the surrounding request flow across services and properties.
