/**
 * @platform/api/http
 *
 * HTTP-layer helpers that bridge the framework-agnostic response builders in
 * @platform/utils (ok/fail) to Hono's Context. These keep every route returning
 * the same typed envelope shape (ApiSuccess<T> / ApiError) so that any InMyCity
 * frontend can consume the API uniformly.
 */

import type { Context } from 'hono';
import type { PageMeta } from '../types/index.js';
import { ok, fail } from '../utils/index.js';

/** Canonical error codes returned by the API. Stable contract for clients. */
export const ERROR_CODES = {
  VALIDATION: 'validation_error',
  NOT_FOUND: 'not_found',
  TENANT_INVALID: 'tenant_invalid',
  METHOD_NOT_ALLOWED: 'method_not_allowed',
  RATE_LIMITED: 'rate_limited',
  INTERNAL: 'internal_error',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Map an error code to a sensible default HTTP status. */
const STATUS_BY_CODE: Record<string, number> = {
  [ERROR_CODES.VALIDATION]: 400,
  [ERROR_CODES.TENANT_INVALID]: 400,
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.METHOD_NOT_ALLOWED]: 405,
  [ERROR_CODES.RATE_LIMITED]: 429,
  [ERROR_CODES.INTERNAL]: 500,
};

/** Send a typed success envelope. */
export function sendOk<T>(c: Context, data: T, meta?: PageMeta, status = 200) {
  return c.json(ok(data, meta), status as 200);
}

/** Send a typed error envelope with a status derived from the code. */
export function sendError(
  c: Context,
  code: ErrorCode,
  message: string,
  details?: unknown,
) {
  const status = STATUS_BY_CODE[code] ?? 400;
  return c.json(fail(code, message, details), status as 400);
}

/** Convenience wrappers for the most common error kinds. */
export function notFound(c: Context, message = 'Resource not found') {
  return sendError(c, ERROR_CODES.NOT_FOUND, message);
}

export function validationError(c: Context, message: string, details?: unknown) {
  return sendError(c, ERROR_CODES.VALIDATION, message, details);
}

export function internalError(c: Context, message = 'Internal server error', details?: unknown) {
  return sendError(c, ERROR_CODES.INTERNAL, message, details);
}
