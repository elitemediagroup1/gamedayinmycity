/**
 * Integration + unit tests for the Loop event bus (platform/events).
 *
 * Covers: event creation, serialization, validation, retry behaviour, the
 * dead-letter queue, async publishing through the bus, persistence via the
 * database-backed LoopPublisher, and the GET /api/events/health endpoint.
 */

import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { app } from '../api/server.js';
import { query, closePool } from '../database/client.js';
import {
  createEvent,
  serializeEvent,
  deserializeEvent,
  validateEvent,
  isValidEvent,
  EVENT_TYPES,
  defaultIntentFor,
  RetryPolicy,
  DeadLetterQueue,
  Queue,
  EventBus,
  LoopPublisher,
  toDbEventType,
  configureEventBus,
  publish,
  type PlatformEvent,
} from '../events/EventPublisher.js';
import type { LoopAdapter, PublishOutcome } from '../events/LoopPublisher.js';

afterAll(async () => {
  await closePool();
});

/** Issue an in-process request and parse the JSON envelope. */
async function request(path: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await app.request(path);
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

/** Adapter that fails a fixed number of times, then succeeds. */
class FlakyAdapter implements LoopAdapter {
  readonly name = 'flaky';
  public calls = 0;
  constructor(private readonly failTimes: number) {}
  async publish(): Promise<PublishOutcome> {
    this.calls += 1;
    if (this.calls <= this.failTimes) {
      throw new Error(`induced failure ${this.calls}`);
    }
    return { delivered: true, ref: `ref-${this.calls}` };
  }
  async healthy(): Promise<boolean> {
    return true;
  }
}

/** Adapter that always fails (drives the dead-letter path). */
class DeadAdapter implements LoopAdapter {
  readonly name = 'dead';
  async publish(): Promise<PublishOutcome> {
    throw new Error('permanent failure');
  }
  async healthy(): Promise<boolean> {
    return false;
  }
}

const fastPolicy = () => new RetryPolicy({ baseDelayMs: 1, maxDelayMs: 2, jitter: 0, maxAttempts: 3 });

function sampleInput(overrides: Record<string, unknown> = {}) {
  return {
    event_type: 'waitlist_submit' as const,
    platform_id: 'gameday',
    session_id: 'sess-1',
    payload: { email: 'fan@example.com' },
    ...overrides,
  };
}

describe('createEvent', () => {
  it('fills ids, timestamp, version and defaults', () => {
    const event = createEvent(sampleInput());
    expect(event.event_id).toBeTruthy();
    expect(event.trace_id).toBeTruthy();
    expect(event.correlation_id).toBe(event.trace_id);
    expect(event.tenant_id).toBe('gameday');
    expect(event.version).toBe(1);
    expect(event.intent).toBe(defaultIntentFor('waitlist_submit'));
    expect(typeof event.timestamp).toBe('string');
  });

  it('throws on an unknown event type', () => {
    expect(() => createEvent(sampleInput({ event_type: 'nope' }))).toThrow();
  });

  it('requires a platform_id', () => {
    expect(() => createEvent(sampleInput({ platform_id: '' }))).toThrow();
  });
});

describe('serialization', () => {
  it('round-trips an event through JSON', () => {
    const event = createEvent(sampleInput());
    const restored = deserializeEvent(serializeEvent(event));
    expect(restored).toEqual(event);
  });
});

describe('validation', () => {
  it('accepts a well-formed event', () => {
    const event = createEvent(sampleInput());
    expect(isValidEvent(event)).toBe(true);
  });

  it('rejects a malformed event with structured issues', () => {
    const broken = { ...createEvent(sampleInput()), event_type: 'bogus' };
    const result = validateEvent(broken);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toHaveProperty('path');
    }
  });

  it('covers every catalogue type in the db mapping', () => {
    for (const type of EVENT_TYPES) {
      expect(typeof toDbEventType(type)).toBe('string');
    }
  });
});

describe('RetryPolicy', () => {
  it('stops retrying at maxAttempts', () => {
    const policy = new RetryPolicy({ maxAttempts: 3 });
    expect(policy.shouldRetry(1)).toBe(true);
    expect(policy.shouldRetry(2)).toBe(true);
    expect(policy.shouldRetry(3)).toBe(false);
  });

  it('grows the delay exponentially (no jitter)', () => {
    const policy = new RetryPolicy({ baseDelayMs: 100, factor: 2, jitter: 0, maxDelayMs: 10_000 });
    expect(policy.nextDelayMs(1)).toBe(100);
    expect(policy.nextDelayMs(2)).toBe(200);
    expect(policy.nextDelayMs(3)).toBe(400);
  });

  it('caps the delay at maxDelayMs', () => {
    const policy = new RetryPolicy({ baseDelayMs: 100, factor: 10, jitter: 0, maxDelayMs: 500 });
    expect(policy.nextDelayMs(5)).toBe(500);
  });
});

describe('Queue retry + dead-letter', () => {
  it('retries a flaky adapter until it succeeds', async () => {
    const adapter = new FlakyAdapter(2);
    const queue = new Queue({ adapter, retryPolicy: fastPolicy() });
    const event = createEvent(sampleInput());
    const ok = await queue.deliver(event);
    expect(ok).toBe(true);
    expect(adapter.calls).toBe(3);
    const metrics = await queue.metrics();
    expect(metrics.delivered).toBe(1);
    expect(metrics.retried).toBe(2);
  });

  it('dead-letters an event after exhausting retries', async () => {
    const dlq = new DeadLetterQueue();
    const queue = new Queue({ adapter: new DeadAdapter(), retryPolicy: fastPolicy(), deadLetters: dlq });
    const event = createEvent(sampleInput());
    const ok = await queue.deliver(event);
    expect(ok).toBe(false);
    expect(await dlq.size()).toBe(1);
    const letters = await dlq.list();
    expect(letters[0]?.event.event_id).toBe(event.event_id);
    expect(letters[0]?.attempts).toBe(3);
  });
});

describe('DeadLetterQueue', () => {
  it('drains and bounds its contents', async () => {
    const dlq = new DeadLetterQueue(2);
    const mk = () => ({
      event: createEvent(sampleInput()),
      reason: 'x',
      attempts: 1,
      failed_at: new Date().toISOString(),
    });
    await dlq.add(mk());
    await dlq.add(mk());
    await dlq.add(mk());
    expect(await dlq.size()).toBe(2);
    expect(dlq.evicted).toBe(1);
    const drained = await dlq.drain();
    expect(drained.length).toBe(2);
    expect(await dlq.size()).toBe(0);
  });
});

describe('EventBus publish', () => {
  it('rejects an invalid event up front', () => {
    const bus = new EventBus({ adapter: new FlakyAdapter(0) });
    // session_id is not a string, so the envelope fails validation.
    const result = bus.publish(sampleInput({ session_id: 123 }) as never);
    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  it('accepts and synchronously delivers a valid event', async () => {
    const adapter = new FlakyAdapter(0);
    const bus = new EventBus({ adapter, retryPolicy: fastPolicy() });
    const result = await bus.publishSync(sampleInput());
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.delivered).toBe(true);
    }
    expect(adapter.calls).toBe(1);
  });
});

describe('LoopPublisher persistence', () => {
  let inserted: string | null = null;

  it('writes a canonical event into platform_events', async () => {
    const publisher = new LoopPublisher();
    const event: PlatformEvent = createEvent(
      sampleInput({ event_type: 'partner_click', resource_type: 'partner', resource_id: 'acme' }),
    );
    const outcome = await publisher.publish(event);
    expect(outcome.delivered).toBe(true);
    expect(outcome.ref).toBeTruthy();
    inserted = outcome.ref;

    const rows = await query<{ id: string; event_type: string; payload: Record<string, unknown> }>(
      'SELECT id, event_type, payload FROM platform_events WHERE id = $1',
      [inserted],
    );
    expect(rows.rowCount).toBe(1);
    // partner_click maps down to the persisted 'partner_lead' enum value.
    expect(rows.rows[0]?.event_type).toBe('partner_lead');
    const env = (rows.rows[0]?.payload as { __event?: { event_type?: string } }).__event;
    expect(env?.event_type).toBe('partner_click');
  });

  afterAll(async () => {
    if (inserted) {
      await query('DELETE FROM platform_events WHERE id = $1', [inserted]);
    }
  });
});

describe('GET /api/events/health', () => {
  beforeEach(() => {
    // Fresh default bus (database adapter) for each health assertion.
    configureEventBus(null);
  });

  it('reports queue metrics and dependency health', async () => {
    const { status, body } = await request('/api/events/health');
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    const data = body.data as Record<string, unknown>;
    expect(data).toHaveProperty('queue');
    expect(data).toHaveProperty('checks');
    expect(data).toHaveProperty('adapter');
    const checks = data.checks as Record<string, string>;
    expect(checks.database).toBe('ok');
    const queue = data.queue as Record<string, unknown>;
    expect(queue).toHaveProperty('depth');
    expect(queue).toHaveProperty('dead_lettered');
  });

  it('publish() through the shared bus enqueues without throwing', () => {
    const result = publish(sampleInput());
    expect(result.accepted).toBe(true);
  });
});
