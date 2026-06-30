/**
 * @platform/api/routes/cities
 *
 * GET /api/cities — list cities for the resolved tenant. In addition to the
 * shared status / coverage / q / pagination filters, cities can be scoped to a
 * state via ?state=<state-slug>, resolved against the tenant's states.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { TenantVariables } from '../tenant.js';
import { getPlatformId } from '../tenant.js';
import { CityFilters } from '../validation.js';
import { listResource } from './_list.js';
import { sendOk, validationError } from '../http.js';

const CITY_COLUMNS = [
  'id',
  'platform_id',
  'state_id',
  'slug',
  'name',
  'status',
  'coverage',
  'created_at',
  'updated_at',
];

export const citiesRoutes = new Hono<{ Variables: TenantVariables }>();

citiesRoutes.get(
  '/',
  zValidator('query', CityFilters, (result, c) => {
    if (!result.success) {
      return validationError(c, 'Invalid query parameters', result.error.flatten());
    }
    return;
  }),
  async (c) => {
    const { page, per_page, status, coverage, q, state } = c.req.valid('query');
    const platformId = getPlatformId(c);

    // Scope to a state by matching its slug within the same tenant.
    const extraWhere = state
      ? [
          {
            sql: 'state_id = (SELECT id FROM states WHERE platform_id = $1 AND slug = $2 AND deleted_at IS NULL)',
            params: [platformId, state],
          },
        ]
      : undefined;

    const result = await listResource({
      table: 'cities',
      columns: CITY_COLUMNS,
      platformId,
      pagination: { page, per_page },
      status,
      coverage,
      q,
      extraWhere,
      orderBy: 'name ASC',
    });
    return sendOk(c, result.rows, result.meta);
  },
);
