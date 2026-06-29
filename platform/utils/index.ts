/**
 * @platform/utils
 *
 * Small, dependency-free helpers shared across the platform: slugs,
 * pagination math, and typed API response builders.
 */

import type { ApiError, ApiSuccess, PageMeta } from '../types/index.js';

// ---------------------------------------------------------------------------
// Slugs
// ---------------------------------------------------------------------------

/**
 * Convert arbitrary text into a url-safe slug.
 * Lowercases, strips diacritics, collapses non-alphanumerics to single dashes.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginationInput {
  page?: number;
  per_page?: number;
}

export interface ResolvedPagination {
  page: number;
  per_page: number;
  limit: number;
  offset: number;
}

const MAX_PER_PAGE = 100;
const DEFAULT_PER_PAGE = 20;

/** Normalise raw pagination input into safe limit/offset values. */
export function resolvePagination(input: PaginationInput): ResolvedPagination {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const per_page = Math.min(MAX_PER_PAGE, Math.max(1, Math.floor(input.per_page ?? DEFAULT_PER_PAGE)));
  return {
    page,
    per_page,
    limit: per_page,
    offset: (page - 1) * per_page,
  };
}

/** Build a PageMeta object from a resolved page and a total row count. */
export function buildPageMeta(p: ResolvedPagination, total: number): PageMeta {
  return {
    page: p.page,
    per_page: p.per_page,
    total,
    total_pages: p.per_page > 0 ? Math.ceil(total / p.per_page) : 0,
  };
}

// ---------------------------------------------------------------------------
// Response builders
// ---------------------------------------------------------------------------

export function ok<T>(data: T, meta?: PageMeta): ApiSuccess<T> {
  return meta ? { ok: true, data, meta } : { ok: true, data };
}

export function fail(code: string, message: string, details?: unknown): ApiError {
  return { ok: false, error: details === undefined ? { code, message } : { code, message, details } };
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/** Current time as an ISO-8601 string. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Type guard: a non-empty trimmed string. */
export function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Sleep helper for retry/backoff logic. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run an async function with simple exponential backoff.
 * Used by provider adapters and cache reconnection.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseMs?: number } = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseMs = opts.baseMs ?? 200;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      await sleep(baseMs * Math.pow(2, attempt));
    }
  }
  throw lastErr;
}
