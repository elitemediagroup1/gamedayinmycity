# Loop Integration

How the event platform talks to EMG Loop. Implemented by the `LoopAdapter`
interface and the v1 `LoopPublisher` in `platform/events/`.

## The adapter contract

```ts
interface LoopAdapter {
  readonly name: string;
  publish(event: PlatformEvent): Promise<PublishOutcome>;
  healthy(): Promise<boolean>;
}
```

Any transport — RabbitMQ, Kafka, Redis Streams, NATS, SQS, Pub/Sub, or an HTTP
ingest endpoint — can implement this. The bus depends on the interface, never a
concrete transport, so switching is a one-line wiring change via
`configureEventBus({ adapter })` and touches no producer code.

## v1 adapter: the database

`LoopPublisher` writes each event into the existing `platform_events`
ingestion table. This is the native Loop contract: Loop reads that table to
ingest activity and route high-intent actions into workflows. Loop automation
itself is **not** implemented here — only the producer side of the contract.

### Type mapping

The persisted `loop_event_type` enum is a small, stable set. The richer
canonical catalogue is mapped down onto it through `DB_EVENT_TYPE_MAP`, while
the **complete** canonical envelope is preserved inside the row's JSONB
`payload` under an `__event` key. Examples:

| Canonical type | Persisted `event_type` |
| --- | --- |
| `waitlist_submit` | `waitlist_submit` |
| `partner_click`, `partner_lead` | `partner_lead` |
| `ticket_click`, `hotel_click`, `travel_click` | `affiliate_click` |
| `livestream_interest` | `live_stream_interest` |
| `user_signup` | `form_submit` |
| `page_view`, `article_view`, `team_view`, ... | `content_view` |

This lets the event vocabulary grow freely **without database migrations** and
without losing information: the original `event_type` always survives in
`payload.__event.event_type`.

### Row shape written

`platform_id`, `event_type` (mapped), `intent`, `actor_id` (= `user_id`),
`session_id`, `subject_type` (= `resource_type`), `subject_id` (=
`resource_id`), `payload` (business payload + `__event` envelope), `source`.

## External forwarding (deferred)

`loopForwardingEnabled()` reflects the `LOOP_ENABLED` config flag and the
presence of `LOOP_INGEST_URL` / `LOOP_API_KEY`. The native database contract is
always on. Forwarding the same events to an external Loop ingest endpoint or
broker is gated behind this flag and ships with a future transport adapter — no
real credentials are committed; only placeholders live in `.env.example`.

## Multi-property

The integration is property-agnostic. GameDayInMyCity is one producer;
CareInMyCity, PetsInMyCity, ServicesInMyCity, SchoolsInMyCity, MarriageInMyCity,
FamiliesInMyCity, and any future application publish through the identical
`publish()` surface and land in the same `platform_events` stream, scoped by
`platform_id`.
