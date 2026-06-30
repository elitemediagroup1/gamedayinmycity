/**
 * @platform/events/Queue
 *
 * Asynchronous, at-least-once delivery queue. Events are enqueued by the bus
 * and drained by a background loop that hands each one to a {@link LoopAdapter}.
 * Failed deliveries are retried per the {@link RetryPolicy}; permanently failed
 * events go to the {@link DeadLetterQueue}. Nothing is ever dropped.
 *
 * This single-process, in-memory queue is the v1 foundation. The same surface
 * (enqueue / metrics / lifecycle) can later be backed by Redis, SQS, etc.
 */

import { sleep } from '../utils/index.js';
import { RetryPolicy } from './RetryPolicy.js';
import { DeadLetterQueue, type DeadLetterSink } from './DeadLetterQueue.js';
import type { LoopAdapter } from './LoopPublisher.js';
import type { PlatformEvent } from './Event.js';

/** Per-event structured log line emitted around each delivery attempt. */
export interface EventLogRecord {
  event_id: string;
  event_type: string;
  trace_id: string;
  correlation_id: string;
  status: 'delivered' | 'retrying' | 'dead_lettered';
  attempt: number;
  processing_ms: number;
  error?: string;
}

/** Sink for structured logs. Defaults to console; swappable for a real logger. */
export type EventLogger = (record: EventLogRecord) => void;

/** A snapshot of queue health for the observability endpoint. */
export interface QueueMetrics {
  depth: number;
  in_flight: number;
  delivered: number;
  retried: number;
  failed: number;
  dead_lettered: number;
  last_publish_at: string | null;
  last_retry_at: string | null;
  running: boolean;
}

export interface QueueOptions {
  adapter: LoopAdapter;
  retryPolicy?: RetryPolicy;
  deadLetters?: DeadLetterSink;
  logger?: EventLogger;
}

interface Envelope {
  event: PlatformEvent;
  attempts: number;
}

const defaultLogger: EventLogger = (record) => {
  // Structured, single-line JSON so log aggregators can parse every field.
  console.log(JSON.stringify({ scope: 'events.queue', ...record }));
};

/**
 * In-memory async event queue with retry + dead-letter handling.
 */
export class Queue {
  private readonly adapter: LoopAdapter;
  private readonly retryPolicy: RetryPolicy;
  private readonly deadLetters: DeadLetterSink;
  private readonly logger: EventLogger;

  private readonly buffer: Envelope[] = [];
  private running = false;
  private inFlight = 0;

  private delivered = 0;
  private retried = 0;
  private failed = 0;
  private deadLetteredCount = 0;
  private lastPublishAt: string | null = null;
  private lastRetryAt: string | null = null;

  constructor(options: QueueOptions) {
    this.adapter = options.adapter;
    this.retryPolicy = options.retryPolicy ?? new RetryPolicy();
    this.deadLetters = options.deadLetters ?? new DeadLetterQueue();
    this.logger = options.logger ?? defaultLogger;
  }

  /** Add an event for asynchronous delivery. Returns immediately. */
  enqueue(event: PlatformEvent): void {
    this.buffer.push({ event, attempts: 0 });
  }

  /** Number of events waiting to be processed. */
  get depth(): number {
    return this.buffer.length;
  }

  /** Access the dead-letter sink (for inspection / replay). */
  get deadLetterSink(): DeadLetterSink {
    return this.deadLetters;
  }

  /** Current health snapshot. */
  async metrics(): Promise<QueueMetrics> {
    return {
      depth: this.buffer.length,
      in_flight: this.inFlight,
      delivered: this.delivered,
      retried: this.retried,
      failed: this.failed,
      dead_lettered: await this.deadLetters.size(),
      last_publish_at: this.lastPublishAt,
      last_retry_at: this.lastRetryAt,
      running: this.running,
    };
  }

  /**
   * Deliver a single event with full retry + dead-letter handling. Exposed so
   * the bus can offer a synchronous publish path and tests can drive delivery
   * deterministically without the background loop.
   */
  async deliver(event: PlatformEvent): Promise<boolean> {
    let attempts = 0;
    // eslint-disable-next-line no-constant-condition
    for (;;) {
      attempts += 1;
      const startedAt = Date.now();
      try {
        await this.adapter.publish(event);
        this.delivered += 1;
        this.lastPublishAt = new Date().toISOString();
        this.logger({
          event_id: event.event_id,
          event_type: event.event_type,
          trace_id: event.trace_id,
          correlation_id: event.correlation_id,
          status: 'delivered',
          attempt: attempts,
          processing_ms: Date.now() - startedAt,
        });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (this.retryPolicy.shouldRetry(attempts)) {
          this.retried += 1;
          this.lastRetryAt = new Date().toISOString();
          this.logger({
            event_id: event.event_id,
            event_type: event.event_type,
            trace_id: event.trace_id,
            correlation_id: event.correlation_id,
            status: 'retrying',
            attempt: attempts,
            processing_ms: Date.now() - startedAt,
            error: message,
          });
          await sleep(this.retryPolicy.nextDelayMs(attempts));
          continue;
        }
        this.failed += 1;
        this.deadLetteredCount += 1;
        await this.deadLetters.add({
          event,
          reason: message,
          attempts,
          failed_at: new Date().toISOString(),
        });
        this.logger({
          event_id: event.event_id,
          event_type: event.event_type,
          trace_id: event.trace_id,
          correlation_id: event.correlation_id,
          status: 'dead_lettered',
          attempt: attempts,
          processing_ms: Date.now() - startedAt,
          error: message,
        });
        return false;
      }
    }
  }

  /** Process every currently-buffered event once, sequentially. */
  async flush(): Promise<void> {
    while (this.buffer.length > 0) {
      const next = this.buffer.shift();
      if (!next) break;
      this.inFlight += 1;
      try {
        await this.deliver(next.event);
      } finally {
        this.inFlight -= 1;
      }
    }
  }

  /** Start the background drain loop. Idempotent. */
  start(idleMs = 50): void {
    if (this.running) return;
    this.running = true;
    void this.loop(idleMs);
  }

  /** Stop the background drain loop after the current cycle. */
  stop(): void {
    this.running = false;
  }

  private async loop(idleMs: number): Promise<void> {
    while (this.running) {
      if (this.buffer.length === 0) {
        await sleep(idleMs);
        continue;
      }
      await this.flush();
    }
  }
}
