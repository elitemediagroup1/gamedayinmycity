/**
 * @platform/events/EventTypes
 *
 * Canonical catalogue of platform event types, sources, and the current
 * event-contract version. This module is intentionally generic: it knows
 * nothing about sports, GameDay, or any single property. Every InMyCity
 * application (Care, Pets, Services, Schools, Marriage, Families, ...) is a
 * producer that publishes events drawn from this catalogue.
 *
 * The event system operates at the application layer with this rich set of
 * types. The Loop database adapter (LoopPublisher) maps each type down onto
 * the persisted `loop_event_type` enum, preserving the full canonical
 * envelope inside the row payload. That keeps the storage schema untouched
 * while allowing the event vocabulary to grow freely.
 */

/** Current version of the canonical event contract (semver-ish, integer-major). */
export const EVENT_CONTRACT_VERSION = 1 as const;
export type EventContractVersion = typeof EVENT_CONTRACT_VERSION;

/**
 * The full catalogue of event types every property may emit. Additive by
 * design: appending a new member here is a non-breaking change.
 */
export const EVENT_TYPES = [
  'waitlist_submit',
  'coach_query',
  'search_query',
  'page_view',
  'city_interest',
  'sport_interest',
  'affiliate_click',
  'partner_click',
  'partner_lead',
  'article_view',
  'guide_view',
  'video_play',
  'livestream_interest',
  'ticket_click',
  'travel_click',
  'hotel_click',
  'parking_click',
  'tailgate_click',
  'facility_view',
  'league_view',
  'team_view',
  'game_view',
  'user_signup',
  'login',
  'logout',
  'notification_open',
  'notification_click',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

const EVENT_TYPE_SET: ReadonlySet<string> = new Set(EVENT_TYPES);

/** Runtime guard for {@link EventType}. */
export function isEventType(value: unknown): value is EventType {
  return typeof value === 'string' && EVENT_TYPE_SET.has(value);
}

/**
 * Known producers of events. `source` is free-form on the wire (any string is
 * accepted) but these constants document the canonical values and let callers
 * avoid typos.
 */
export const EVENT_SOURCES = [
  'web',
  'mobile',
  'api',
  'server',
  'worker',
  'system',
] as const;

export type EventSource = (typeof EVENT_SOURCES)[number];

/**
 * Loosely-typed subject categories an event can reference. Free-form on the
 * wire; these document the common values across properties.
 */
export const RESOURCE_TYPES = [
  'city',
  'state',
  'sport',
  'league',
  'team',
  'game',
  'facility',
  'article',
  'guide',
  'video',
  'livestream',
  'partner',
  'affiliate',
  'ticket',
  'hotel',
  'travel',
  'parking',
  'tailgate',
  'waitlist',
  'user',
  'notification',
  'search',
  'coach',
  'page',
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

/** Coarse priority hint Loop uses to triage automation. */
export const EVENT_INTENTS = ['low', 'medium', 'high'] as const;
export type EventIntent = (typeof EVENT_INTENTS)[number];

/**
 * Default intent per event type. High-intent actions (leads, signups,
 * submissions) are surfaced first by downstream Loop automation. Anything not
 * listed defaults to 'low' via {@link defaultIntentFor}.
 */
export const DEFAULT_EVENT_INTENT: Partial<Record<EventType, EventIntent>> = {
  waitlist_submit: 'high',
  partner_lead: 'high',
  user_signup: 'high',
  coach_query: 'medium',
  partner_click: 'medium',
  affiliate_click: 'medium',
  ticket_click: 'medium',
  travel_click: 'medium',
  hotel_click: 'medium',
  city_interest: 'medium',
  sport_interest: 'medium',
  livestream_interest: 'medium',
  search_query: 'medium',
  login: 'low',
  logout: 'low',
  page_view: 'low',
};

/** Resolve the default intent for an event type (falls back to 'low'). */
export function defaultIntentFor(type: EventType): EventIntent {
  return DEFAULT_EVENT_INTENT[type] ?? 'low';
}
