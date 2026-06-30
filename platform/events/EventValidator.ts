/**
 * @platform/events/EventValidator
 *
 * Schema validation for the canonical event envelope. Validation runs at the
 * boundary (before an event enters the bus) so malformed events never reach
 * the queue, the Loop adapter, or downstream consumers. Built on zod to match
 * the validation approach used by the HTTP API layer.
 */

import { z } from 'zod';
import { EVENT_TYPES, EVENT_INTENTS, EVENT_CONTRACT_VERSION } from './EventTypes.js';
import type { PlatformEvent } from './Event.js';

// zod's z.enum needs a mutable, non-empty string tuple; the event catalogue
// constants are readonly arrays, so widen them the same way the API layer does.
type EnumTuple = [string, ...string[]];
const eventTypeValues = [...EVENT_TYPES] as EnumTuple;
const intentValues = [...EVENT_INTENTS] as EnumTuple;

const nullableString = z.string().min(1).max(512).nullable();
const idString = z.string().min(1).max(256);

/**
 * The full envelope schema. `payload` and `metadata` are open records so
 * properties can attach arbitrary structured data; everything identity- or
 * routing-related is strictly typed.
 */
export const EventSchema = z.object({
  event_id: idString,
  event_type: z.enum(eventTypeValues),
  platform_id: idString,
  tenant_id: idString,
  user_id: nullableString,
  session_id: nullableString,
  anonymous_id: nullableString,
  timestamp: z.string().datetime({ offset: true }),
  source: z.string().min(1).max(64),
  resource_type: z.string().min(1).max(128).nullable(),
  resource_id: z.string().min(1).max(256).nullable(),
  payload: z.record(z.unknown()),
  metadata: z.record(z.unknown()),
  version: z.literal(EVENT_CONTRACT_VERSION),
  trace_id: idString,
  correlation_id: idString,
  intent: z.enum(intentValues),
});

/** Structured detail for a single failed field. */
export interface ValidationIssue {
  path: string;
  message: string;
}

/** Discriminated result of a validation attempt. */
export type ValidationResult =
  | { valid: true; event: PlatformEvent }
  | { valid: false; issues: ValidationIssue[] };

/**
 * Validate an unknown value against the canonical envelope. Never throws;
 * returns a discriminated result the caller can branch on.
 */
export function validateEvent(candidate: unknown): ValidationResult {
  const parsed = EventSchema.safeParse(candidate);
  if (parsed.success) {
    return { valid: true, event: parsed.data as unknown as PlatformEvent };
  }
  const issues: ValidationIssue[] = parsed.error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
  return { valid: false, issues };
}

/** Convenience boolean guard built on {@link validateEvent}. */
export function isValidEvent(candidate: unknown): candidate is PlatformEvent {
  return validateEvent(candidate).valid;
}

/**
 * Validate and throw on failure. Useful where an invalid event is a
 * programming error rather than untrusted input.
 */
export function assertValidEvent(candidate: unknown): PlatformEvent {
  const result = validateEvent(candidate);
  if (!result.valid) {
    const summary = result.issues
      .map((i) => `${i.path}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid platform event: ${summary}`);
  }
  return result.event;
}
