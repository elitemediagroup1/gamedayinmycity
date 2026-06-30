/**
 * @platform/events/Event
 *
 * The canonical platform event envelope. This is the single, stable shape
 * every InMyCity property produces and EMG Loop consumes. It is deliberately
 * domain-agnostic: nothing here references sports or any one application.
 *
 * Identity & correlation fields (event_id, trace_id, correlation_id) make the
 * stream debuggable and let Loop stitch related actions together across
 * sessions, services, and properties.
 */

import {
  EVENT_CONTRACT_VERSION,
  defaultIntentFor,
  isEventType,
  type EventContractVersion,
  type EventIntent,
  type EventSource,
  type EventType,
} from './EventTypes.js';

/**
 * Identifiers describing who/what produced an event. All identity fields are
 * pseudonymous and nullable; secrets must never be placed here.
 */
export interface EventActor {
  /** Authenticated user id, when known. */
  user_id: string | null;
  /** Stable per-session id (cleared when the session ends). */
  session_id: string | null;
  /** Long-lived pseudonymous id for not-yet-identified visitors. */
  anonymous_id: string | null;
}

/** Free-form, structured metadata that travels with an event. */
export type EventMetadata = Record<string, unknown>;
/** Free-form, structured business payload for an event. */
export type EventPayload = Record<string, unknown>;

/**
 * The canonical event. Producers build these via {@link createEvent}; the bus
 * never mutates them after creation (treat as immutable once published).
 */
export interface PlatformEvent {
  /** Globally unique id for this event instance (UUID v4). */
  event_id: string;
  /** What happened. One of the catalogue in EventTypes. */
  event_type: EventType;
  /** Which property emitted it (tenant root identifier). */
  platform_id: string;
  /**
   * Sub-tenant within a platform (e.g. a city/market/org). Defaults to the
   * platform_id when a property has no finer tenancy.
   */
  tenant_id: string;
  /** Authenticated user id, nullable. */
  user_id: string | null;
  /** Session id, nullable. */
  session_id: string | null;
  /** Anonymous visitor id, nullable. */
  anonymous_id: string | null;
  /** ISO-8601 UTC instant the event occurred. */
  timestamp: string;
  /** Producer surface (web, mobile, api, server, worker, system). */
  source: EventSource | string;
  /** Loosely-typed subject category (city, partner, article, ...). */
  resource_type: string | null;
  /** Id/slug of the subject the event refers to. */
  resource_id: string | null;
  /** Structured business payload. */
  payload: EventPayload;
  /** Structured technical metadata (referrer, ua hints, experiment, ...). */
  metadata: EventMetadata;
  /** Event-contract version this envelope conforms to. */
  version: EventContractVersion;
  /** Distributed trace id (one logical request/flow). */
  trace_id: string;
  /** Correlation id grouping a chain of related events. */
  correlation_id: string;
  /** Triage priority hint for downstream automation. */
  intent: EventIntent;
}

/**
 * The caller-supplied shape. Everything the producer should not have to think
 * about (ids, timestamp, version, defaults) is filled in by {@link createEvent}.
 */
export interface EventInput {
  event_type: EventType;
  platform_id: string;
  tenant_id?: string;
  user_id?: string | null;
  session_id?: string | null;
  anonymous_id?: string | null;
  source?: EventSource | string;
  resource_type?: string | null;
  resource_id?: string | null;
  payload?: EventPayload;
  metadata?: EventMetadata;
  intent?: EventIntent;
  timestamp?: string;
  trace_id?: string;
  correlation_id?: string;
  event_id?: string;
}

/**
 * RFC-4122 v4 UUID. Uses the platform crypto when available and degrades to a
 * deterministic-entropy fallback so the bus never throws in constrained
 * runtimes. Not used for cryptographic purposes.
 */
export function newId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto && typeof g.crypto.randomUUID === 'function') {
    return g.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Build a fully-formed {@link PlatformEvent} from caller input. Pure and
 * synchronous: generates ids, stamps the time and contract version, derives a
 * default intent, and normalises optional fields to their canonical nulls.
 */
export function createEvent(input: EventInput): PlatformEvent {
  if (!isEventType(input.event_type)) {
    throw new Error(`createEvent: unknown event_type "${String(input.event_type)}"`);
  }
  if (!input.platform_id || typeof input.platform_id !== 'string') {
    throw new Error('createEvent: platform_id is required');
  }

  const eventId = input.event_id ?? newId();
  const traceId = input.trace_id ?? newId();

  return {
    event_id: eventId,
    event_type: input.event_type,
    platform_id: input.platform_id,
    tenant_id: input.tenant_id ?? input.platform_id,
    user_id: input.user_id ?? null,
    session_id: input.session_id ?? null,
    anonymous_id: input.anonymous_id ?? null,
    timestamp: input.timestamp ?? new Date().toISOString(),
    source: input.source ?? 'web',
    resource_type: input.resource_type ?? null,
    resource_id: input.resource_id ?? null,
    payload: input.payload ?? {},
    metadata: input.metadata ?? {},
    version: EVENT_CONTRACT_VERSION,
    trace_id: traceId,
    correlation_id: input.correlation_id ?? traceId,
    intent: input.intent ?? defaultIntentFor(input.event_type),
  };
}

/** Serialise an event to a deterministic JSON string for transport/storage. */
export function serializeEvent(event: PlatformEvent): string {
  return JSON.stringify(event);
}

/** Parse a JSON string back into an event object (no validation performed). */
export function deserializeEvent(raw: string): PlatformEvent {
  return JSON.parse(raw) as PlatformEvent;
}
