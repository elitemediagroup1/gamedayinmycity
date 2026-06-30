/**
 * @platform/api/tenant
 *
 * Tenant (platform) resolution middleware. Every request is scoped to exactly
 * one InMyCity property via a platform id. Resolution order:
 *   1. the `X-Platform-Id` request header
 *   2. the `platform` query string parameter
 *   3. the configured default tenant (gameday)
 *
 * The resolved id is validated against the known PLATFORM_IDS and stored on the
 * Hono context so downstream handlers can scope every DB query by platform_id.
 * This is the single choke point that enforces shared-schema multi-tenancy.
 */

import type { Context, MiddlewareHandler } from 'hono';
import { isPlatformId, type PlatformId } from '../types/index.js';
import { ERROR_CODES } from './http.js';
import { fail } from '../utils/index.js';

export const DEFAULT_PLATFORM_ID: PlatformId = 'gameday';
export const PLATFORM_HEADER = 'x-platform-id';

/** Hono context variable map contributed by this middleware. */
export interface TenantVariables {
  platformId: PlatformId;
}

/**
 * Resolve and validate the tenant for the request. On an unknown platform id we
 * fail closed with a 400 rather than silently falling back, so misconfigured
 * clients are caught early.
 */
export const tenantResolver = (): MiddlewareHandler => {
  return async (c, next) => {
    const headerValue = c.req.header(PLATFORM_HEADER);
    const queryValue = c.req.query('platform');
    const raw = (headerValue ?? queryValue ?? DEFAULT_PLATFORM_ID).trim().toLowerCase();

    if (!isPlatformId(raw)) {
      return c.json(
        fail(ERROR_CODES.TENANT_INVALID, `Unknown platform id: ${raw}`),
        400,
      );
    }

    c.set('platformId', raw);
    await next();
    return;
  };
};

/** Typed accessor for handlers. Throws if the middleware was not applied. */
export function getPlatformId(c: Context): PlatformId {
  const id = c.get('platformId') as PlatformId | undefined;
  if (!id) {
    throw new Error('getPlatformId: tenantResolver middleware was not applied');
  }
  return id;
}
