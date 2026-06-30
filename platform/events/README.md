# @platform/events — Loop Core Event Platform

The platform-wide event bus and the first EMG Loop integration layer. This is
the communication backbone for **every** InMyCity property. Applications
produce structured events; Loop consumes, routes, and orchestrates them.

> GameDayInMyCity is no longer the centre of the architecture. EMG Loop is.
> GameDay is simply the first *producer*. CareInMyCity, PetsInMyCity,
> ServicesInMyCity, SchoolsInMyCity, MarriageInMyCity, FamiliesInMyCity and
> every future application publish through the same interface, unchanged.

## Design principles

- **Generic.** Nothing in this module knows about sports, GameDay, or any one
  domain. The event catalogue is a flat, extensible vocabulary.
- **Decoupled.** Producers call `publish(event)` and never learn where events
  go. The transport lives behind the `LoopAdapter` interface.
- **Durable.** Failed deliveries retry; permanent failures are dead-lettered.
  Nothing is silently dropped.
- **Observable.** Every delivery emits a structured log line with trace and
  correlation ids, processing time, status, and attempt count.

## Module map

| File | Responsibility |
| --- | --- |
| `EventTypes.ts` | The canonical catalogue: event types, sources, resource types, intents, contract version. |
| `Event.ts` | The canonical event envelope + `createEvent` factory + (de)serialization. |
| `EventValidator.ts` | Boundary validation (zod) for the envelope. |
| `RetryPolicy.ts` | Pure exponential-backoff-with-jitter retry decisions. |
| `DeadLetterQueue.ts` | Bounded sink for permanently failed events. |
| `Queue.ts` | Async at-least-once delivery loop with retry + DLQ + metrics. |
| `LoopPublisher.ts` | First Loop adapter; persists events to the database today. |
| `EventBus.ts` | Orchestrator wiring validation + queue + adapter together. |
| `EventPublisher.ts` | The public `publish()` surface + module barrel. |

## Quick start

```ts
import { publish } from '@platform/events/EventPublisher';

publish({
  event_type: 'waitlist_submit',
  platform_id: 'gameday',
  session_id: sessionId,
  resource_type: 'city',
  resource_id: 'austin-tx',
  payload: { email },
});
```

That is the entire producer contract. Validation, queuing, retries,
dead-lettering, and persistence all happen behind the call.

## Swapping transports

`LoopPublisher` (database) is the v1 adapter. To move to a broker (RabbitMQ,
Kafka, Redis Streams, NATS, SQS, Pub/Sub), implement the `LoopAdapter`
interface and pass it to the bus:

```ts
import { configureEventBus } from '@platform/events/EventPublisher';
configureEventBus({ adapter: new KafkaLoopAdapter(/* ... */) });
```

No call site changes.

## Further reading

- [`docs/EVENT_MODEL.md`](../../docs/EVENT_MODEL.md) — the canonical event contract.
- [`docs/EVENT_BUS.md`](../../docs/EVENT_BUS.md) — bus, queue, retry, and DLQ internals.
- [`docs/LOOP_INTEGRATION.md`](../../docs/LOOP_INTEGRATION.md) — the Loop adapter and mapping.
- [`docs/OBSERVABILITY.md`](../../docs/OBSERVABILITY.md) — logging, metrics, and the health endpoint.
