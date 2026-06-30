/**
 * @platform/events/EventPublisher
 *
 * The public publishing surface for the whole platform and the barrel export
 * for the events module. Application code imports ONLY from here:
 *
 *   import { publish } from '@platform/events/EventPublisher';
 *   publish({ event_type: 'waitlist_submit', platform_id: 'gameday', ... });
 *
 * Producers never know where events go. The process-wide {@link EventBus}
 * singleton owns the transport (today: the database-backed LoopPublisher),
 * so changing or adding transports never touches a single call site.
 */

import { EventBus, type EventBusOptions, type PublishResult } from './EventBus.js';
import type { EventInput } from './Event.js';

let singleton: EventBus | null = null;

/** The lazily-created, process-wide event bus. */
export function getEventBus(): EventBus {
  if (!singleton) {
    singleton = new EventBus();
  }
  return singleton;
}

/**
 * Replace the process-wide bus (tests / custom transport wiring). Passing no
 * options rebuilds a default bus; passing null clears it so the next access
 * recreates a fresh default.
 */
export function configureEventBus(options?: EventBusOptions | null): EventBus {
  singleton = options === null ? null : new EventBus(options ?? {});
  return getEventBus();
}

/**
 * Publish an event (asynchronous, at-least-once). This is THE function every
 * InMyCity property calls. Returns once the event is validated and accepted
 * onto the delivery queue.
 */
export function publish(input: EventInput): PublishResult {
  return getEventBus().publish(input);
}

/**
 * Publish and await delivery confirmation (with retries). Use on request
 * paths that need to know the event reached the transport.
 */
export function publishSync(input: EventInput): Promise<PublishResult> {
  return getEventBus().publishSync(input);
}

// Re-export the building blocks so consumers have a single import root.
export * from './EventTypes.js';
export * from './Event.js';
export * from './EventValidator.js';
export * from './RetryPolicy.js';
export * from './DeadLetterQueue.js';
export * from './Queue.js';
export * from './LoopPublisher.js';
export * from './EventBus.js';
