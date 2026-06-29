/**
 * @platform/types
 *
 * Core type definitions for the GameDay Platform.
 *
 * The platform is PLATFORM-FIRST, not sports-first. Every InMyCity property
 * (GameDayInMyCity, CareInMyCity, PetsInMyCity, ServicesInMyCity,
 * SchoolsInMyCity, ...) is a tenant of this single shared-schema backend.
 *
 * Multi-tenancy is implemented with row-level scoping via \`platform_id\`
 * (a stable slug for the InMyCity property) rather than schema-per-tenant.
 */

// ---------------------------------------------------------------------------
// Tenancy
// ---------------------------------------------------------------------------

/**
 * Stable identifiers for each InMyCity property. New properties are added here
 * AND seeded into the \`platforms\` table; never inferred from free text.
 */
export type PlatformId =
  | 'gameday'
  | 'care'
  | 'pets'
  | 'services'
  | 'schools';

export const PLATFORM_IDS: readonly PlatformId[] = [
  'gameday',
  'care',
  'pets',
  'services',
  'schools',
] as const;

export function isPlatformId(value: unknown): value is PlatformId {
  return typeof value === 'string' && (PLATFORM_IDS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Shared lifecycle / status enums
// ---------------------------------------------------------------------------

/** Publication / availability status applied to every content row. */
export type Status = 'draft' | 'published' | 'archived' | 'pending';

export const STATUSES: readonly Status[] = ['draft', 'published', 'archived', 'pending'] as const;

/** Rollout coverage state — honesty-first: "live" vs "rolling out" vs planned. */
export type Coverage = 'live' | 'rolling_out' | 'planned' | 'paused';

export const COVERAGES: readonly Coverage[] = ['live', 'rolling_out', 'planned', 'paused'] as const;

// ---------------------------------------------------------------------------
// Base entity — every table extends this contract
// ---------------------------------------------------------------------------

/**
 * Columns guaranteed on every domain table by the migration foundation:
 * UUID PK, tenant scoping, slug, status, coverage, source, metadata JSON,
 * and soft-delete + audit timestamps.
 */
export interface BaseEntity {
  id: string;                 // uuid
  platform_id: PlatformId;    // tenant scope
  slug: string;               // url-safe unique-per-(platform,type) key
  status: Status;
  coverage: Coverage;
  source: string | null;      // provenance: 'manual' | 'sportsdataio' | 'import' | ...
  metadata: Record<string, unknown>;
  created_at: string;         // ISO timestamp
  updated_at: string;         // ISO timestamp
  deleted_at: string | null;  // soft delete
}

// ---------------------------------------------------------------------------
// Loop / platform events
// ---------------------------------------------------------------------------

/**
 * EMG Loop is the operating layer above the platform. Every high-intent action
 * across every InMyCity site is captured as a platform event so Loop can
 * ingest activity, track entities, and route workflows. Loop automation is NOT
 * built here — but the event contract is native from day one.
 */
export type LoopEventType =
  | 'waitlist_submit'
  | 'coach_query'
  | 'partner_lead'
  | 'affiliate_click'
  | 'search_query'
  | 'city_interest'
  | 'sport_interest'
  | 'live_stream_interest'
  | 'form_submit'
  | 'content_view';

export const LOOP_EVENT_TYPES: readonly LoopEventType[] = [
  'waitlist_submit',
  'coach_query',
  'partner_lead',
  'affiliate_click',
  'search_query',
  'city_interest',
  'sport_interest',
  'live_stream_interest',
  'form_submit',
  'content_view',
] as const;

export function isLoopEventType(value: unknown): value is LoopEventType {
  return typeof value === 'string' && (LOOP_EVENT_TYPES as readonly string[]).includes(value);
}

/** Intent ranking used by Loop to prioritise routing of an event. */
export type LoopIntent = 'low' | 'medium' | 'high';

export interface PlatformEvent {
  id: string;
  platform_id: PlatformId;
  event_type: LoopEventType;
  intent: LoopIntent;
  /** Optional pseudonymous actor/session id. Never store secrets here. */
  actor_id: string | null;
  session_id: string | null;
  /** Loosely-typed subject the event refers to (city slug, sport slug, ...). */
  subject_type: string | null;
  subject_id: string | null;
  /** Arbitrary structured payload (validated at the API boundary). */
  payload: Record<string, unknown>;
  /** Whether Loop has already consumed/routed this event. */
  routed: boolean;
  created_at: string;
}

/** Default intent weighting for each event type (Loop may override). */
export const DEFAULT_EVENT_INTENT: Record<LoopEventType, LoopIntent> = {
  waitlist_submit: 'high',
  partner_lead: 'high',
  live_stream_interest: 'high',
  coach_query: 'medium',
  affiliate_click: 'medium',
  form_submit: 'medium',
  city_interest: 'medium',
  sport_interest: 'medium',
  search_query: 'low',
  content_view: 'low',
};

// ---------------------------------------------------------------------------
// API envelopes
// ---------------------------------------------------------------------------

export interface PageMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  meta?: PageMeta;
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
