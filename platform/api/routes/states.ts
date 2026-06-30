/**
 * @platform/api/routes/states
 *
 * GET /api/states — list states/regions for the resolved tenant. Supports
 * pagination and status / coverage / q (full-text) filters.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { TenantVariables } from '../tenant.js';
import { getPlatformId } from '../tenant.js';
import { ListFilters } from '../validation.js';
import { listResource } from './_list.js';
import { sendOk, validationError } from '../http.js';

const STATE_COLUMNS = [
  'id',
  'platform_id',
  'slug',
  'name',
  'code',
  'status',
  'coverage',
  'created_at',
  'updated_at',
];

export const statesRoutes = new Hono<{ Variables: TenantVariables }>();

statesRoutes.get(
  '/',
  zValidator('query', ListFilters, (result, c) => {
    if (!result.success) {
      return validationError(c, 'Invalid query parameters', result.error.flatten());
    }
    return;
  }),
  async (c) => {
    const { page, per_page, status, coverage, q } = c.req.valid('query');
    const result = await listResource({
      table: 'states',
      columns: STATE_COLUMNS,
      platformId: getPlatformId(c),
      pagination: { page, per_page },
      status,
      coverage,
      q,
      orderBy: 'name ASC',
    });
    return sendOk(c, result.rows, result.meta);
  },
);
