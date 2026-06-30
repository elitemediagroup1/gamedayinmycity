/**
 * @platform/events/DeadLetterQueue
 *
 * The Dead Letter Queue (DLQ) is where events go when every delivery attempt
 * has been exhausted. Nothing is ever silently dropped: a permanently failed
 * event lands here with its full failure context so it can be inspected,
 * alerted on, and replayed.
 *
 * This in-memory implementation is the v1 foundation. It is bounded (oldest
 * entries are evicted past a cap) and exposes a generic interface so a durable
 * backend (a DB table, an SQS DLQ, a Kafka topic) can be slotted in later
 * without changing callers.
 */

import type { PlatformEvent } from './Event.js';

/** A failed event plus the context needed to diagnose and replay it. */
export interface DeadLetter {
  /** The original event that could not be delivered. */
  event: PlatformEvent;
  /** Human-readable reason for the final failure. */
  reason: string;
  /** How many delivery attempts were made before giving up. */
  attempts: number;
  /** ISO-8601 instant the event was dead-lettered. */
  failed_at: string;
}

/** Pluggable DLQ backend. The bus depends on this interface, not the class. */
export interface DeadLetterSink {
  add(entry: DeadLetter): Promise<void>;
  list(limit?: number): Promise<DeadLetter[]>;
  size(): Promise<number>;
  drain(): Promise<DeadLetter[]>;
}

/**
 * Bounded in-memory DLQ. Suitable for a single-process foundation; replace
 * with a durable sink in production by implementing {@link DeadLetterSink}.
 */
export class DeadLetterQueue implements DeadLetterSink {
  private readonly entries: DeadLetter[] = [];
  private readonly maxSize: number;
  private droppedCount = 0;

  constructor(maxSize = 1000) {
    this.maxSize = Math.max(1, maxSize);
  }

  /** Record a permanently failed event. Evicts the oldest entry when full. */
  async add(entry: DeadLetter): Promise<void> {
    this.entries.push(entry);
    while (this.entries.length > this.maxSize) {
      this.entries.shift();
      this.droppedCount += 1;
    }
  }

  /** Most-recent-first view of dead letters, optionally limited. */
  async list(limit?: number): Promise<DeadLetter[]> {
    const ordered = [...this.entries].reverse();
    return typeof limit === 'number' ? ordered.slice(0, limit) : ordered;
  }

  /** Current number of dead letters retained. */
  async size(): Promise<number> {
    return this.entries.length;
  }

  /** Remove and return every dead letter (e.g. for a replay job). */
  async drain(): Promise<DeadLetter[]> {
    const all = [...this.entries];
    this.entries.length = 0;
    return all;
  }

  /** Count of entries evicted because the bound was exceeded. */
  get evicted(): number {
    return this.droppedCount;
  }
}
