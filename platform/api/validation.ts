/**
 * @platform/api/validation
 *
 * Zod schemas for request input. Centralising these keeps validation rules
 * consistent across routes and lets us reuse them in tests. All list endpoints
 * share the same pagination + filtering contract.
 */

import { z } from 'zod';
import { PLATFORM_IDS, STATUSES, COVERAGES, LOOP_EVENT_TYPES } from '../types/index.js';

// zod's z.enum needs a mutable non-empty string tuple; the platform constants
// are readonly, so we copy them into a fresh tuple before handing them over.
type EnumTuple = [string, ...string[]];
const statusValues = [...STATUSES] as EnumTuple;
const coverageValues = [...COVERAGES] as EnumTuple;
const platformValues = [...PLATFORM_IDS] as EnumTuple;

/** Shared pagination query params. Coerced from strings (query strings). */
export const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

/** Common list filters available on every collection endpoint. */
export const ListFilters = PaginationQuery.extend({
  status: z.enum(statusValues).optional(),
  coverage: z.enum(coverageValues).optional(),
  // Free-text search; trimmed and length-bounded to keep queries cheap.
  q: z.string().trim().min(1).max(120).optional(),
});

/** Filters for the cities endpoint, which can be scoped to a state. */
export const CityFilters = ListFilters.extend({
  state: z.string().trim().min(1).max(96).optional(),
});

/** Filters for the articles endpoint, which can be scoped to a kind. */
export const ArticleFilters = ListFilters.extend({
  kind: z.string().trim().min(1).max(48).optional(),
});

/** Tenant header/param value must be a known platform id. */
export const PlatformIdSchema = z.enum(platformValues);

/** POST /api/waitlist body. */
export const WaitlistBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  // Optional free-text interest (e.g. a sport or city the user cares about).
  interest: z.string().trim().min(1).max(120).optional(),
  // Optional city slug the signup is associated with.
  city: z.string().trim().min(1).max(96).optional(),
  // Optional pseudonymous client session id for Loop attribution.
  session_id: z.string().trim().min(1).max(128).optional(),
});

export type ListFiltersInput = z.infer<typeof ListFilters>;
export type CityFiltersInput = z.infer<typeof CityFilters>;
export type ArticleFiltersInput = z.infer<typeof ArticleFilters>;
export type WaitlistInput = z.infer<typeof WaitlistBody>;

/** Re-exported for callers that need the full set of trackable event names. */
export const TRACKABLE_EVENTS = LOOP_EVENT_TYPES;
