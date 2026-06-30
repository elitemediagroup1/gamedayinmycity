# Event Bus

How events flow from a producer to durable storage, and how failures are
handled. Implemented in `platform/events/`.

## Flow

```
producer.publish(input)
   -> createEvent(input)        // build canonical envelope
   -> validateEvent(event)      // reject malformed events at the boundary
   -> Queue.enqueue(event)      // accepted; returns immediately
        -> Queue.deliver(event) // background drain loop
             -> LoopAdapter.publish(event)
                  success -> metrics.delivered++
                  failure -> RetryPolicy -> retry or DeadLetterQueue
```

## Components

### EventBus

The single object the rest of the platform talks to. It owns one
`LoopAdapter` and one `Queue`. Two publish paths:

- `publish(input)` — validate + enqueue, return immediately (fire-and-forget).
- `publishSync(input)` — validate + deliver, await the result with retries.

It is transport-agnostic: it holds an adapter but never assumes which one.

### Queue

An in-memory, at-least-once delivery queue. `enqueue` buffers an event; a
background loop (`start`/`stop`) drains the buffer, or `flush()` drains it once
synchronously. Each delivery is attempted through the adapter; failures are
retried per the policy and dead-lettered when exhausted. The queue exposes a
metrics snapshot (depth, in-flight, delivered, retried, failed, dead-lettered,
last publish, last retry, running).

### RetryPolicy

A pure (side-effect-free) policy: `shouldRetry(attempt)` and
`nextDelayMs(attempt)`. Defaults: 5 attempts, 200ms base, x2 growth, capped at
30s, with 20% jitter. Being pure makes retry behaviour deterministic in tests
(set `jitter: 0`).

### DeadLetterQueue

A bounded sink for events that exhausted every retry. Each `DeadLetter` keeps
the original event, the failure reason, the attempt count, and the failure
time. Supports `add`, `list`, `size`, and `drain` (for replay jobs). Nothing is
silently dropped; when the bound is exceeded the oldest entry is evicted and
counted.

## At-least-once semantics

Delivery is at-least-once: a transient failure after a partial success could
re-deliver. Consumers should treat `event_id` as an idempotency key. The
database adapter writes a fresh row per attempt only on success, so duplicate
rows are possible under pathological retries and are de-duplicated downstream
by `event_id` stored in the row payload.

## Extensibility

The `Queue`, `RetryPolicy`, and `DeadLetterSink` are all swappable. A future
durable queue (Redis, SQS) implements the same surface; a durable DLQ
implements `DeadLetterSink`. None of these changes touch producers.
