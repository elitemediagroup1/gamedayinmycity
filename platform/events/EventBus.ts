/**
 * @platform/events/EventBus
 *
 * The central event bus. It is the one object the rest of the platform talks
 * to. Responsibilities:
 *   1. Build a canonical event from caller input (via createEvent).
 *   2. Validate it at the boundary (reject malformed events early).
 *   3. Hand it to the delivery {@link Queue}, which retries and dead-letters.
 *
 * The bus is transport-agnostic: it holds a {@link LoopAdapter} but never
 * assumes which transport it is. Swapping the DB adapter for a broker adapter
 * is a one-line change here and invisible to every publisher.
 */

import { createEvent, type EventInput, type PlatformEvent } from './Event.js';
import { validateEvent, type ValidationIssue } from './EventValidator.js';
import { Queue, type QueueMetrics, type EventLogger } from './Queue.js';
import { RetryPolicy } from './RetryPolicy.js';
import type { DeadLetterSink, DeadLetter } from './DeadLetterQueue.js';
import { LoopPublisher, type LoopAdapter } from './LoopPublisher.js';

export interface EventBusOptions {
  /** Transport adapter. Defaults to the database-backed LoopPublisher. */
  adapter?: LoopAdapter;
  retryPolicy?: RetryPolicy;
  deadLetters?: DeadLetterSink;
  logger?: EventLogger;
}

/** Result of attempting to publish an event. */
export type PublishResult =
  | { accepted: true; event: PlatformEvent; delivered: boolean }
  | { accepted: false; issues: ValidationIssue[] };

/**
 * The platform event bus. Construct one per process (see the shared singleton
 * exported from EventPublisher) and share it across the app.
 */
export class EventBus {
  private readonly adapter: LoopAdapter;
  private readonly queue: Queue;

  constructor(options: EventBusOptions = {}) {
    this.adapter = options.adapter ?? new LoopPublisher();
    this.queue = new Queue({
      adapter: this.adapter,
      retryPolicy: options.retryPolicy,
      deadLetters: options.deadLetters,
      logger: options.logger,
    });
  }

  /**
   * Validate and enqueue an event for asynchronous delivery. Returns as soon
   * as the event is accepted onto the queue (fire-and-forget for producers).
   */
  publish(input: EventInput): PublishResult {
    const event = createEvent(input);
    const result = validateEvent(event);
    if (!result.valid) {
      return { accepted: false, issues: result.issues };
    }
    this.queue.enqueue(result.event);
    return { accepted: true, event: result.event, delivered: false };
  }

  /**
   * Validate and deliver an event synchronously, awaiting the result (with
   * retries). Useful for request paths that want delivery confirmation.
   */
  async publishSync(input: EventInput): Promise<PublishResult> {
    const event = createEvent(input);
    const result = validateEvent(event);
    if (!result.valid) {
      return { accepted: false, issues: result.issues };
    }
    const delivered = await this.queue.deliver(result.event);
    return { accepted: true, event: result.event, delivered };
  }

  /** Process every buffered event once (drains the queue). */
  async flush(): Promise<void> {
    await this.queue.flush();
  }

  /** Start background draining. */
  start(): void {
    this.queue.start();
  }

  /** Stop background draining. */
  stop(): void {
    this.queue.stop();
  }

  /** Current queue/delivery metrics. */
  async metrics(): Promise<QueueMetrics> {
    return this.queue.metrics();
  }

  /** Most-recent dead letters for inspection. */
  async deadLetters(limit?: number): Promise<DeadLetter[]> {
    return this.queue.deadLetterSink.list(limit);
  }

  /** Probe the underlying transport adapter. */
  async adapterHealthy(): Promise<boolean> {
    return this.adapter.healthy();
  }

  /** Name of the active transport adapter (e.g. 'database'). */
  get adapterName(): string {
    return this.adapter.name;
  }
}

