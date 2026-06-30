/**
 * @platform/api/routes/sports
 *
 * GET /api/sports — list sports for the resolved tenant. Supports pagination
 * and status / coverage / q (full-text) filters via the shared list builder.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { TenantVariables } from '../tenant.js';
import { getPlatformId } from '../tenant.js';
import { ListFilters } from '../validation.js';
import { listResource } from './_list.js';
import { sendOk, validationError } from '../http.js';

const SPORT_COLUMNS = [
  'id',
  'platform_id',
  'slug',
  'name',
  'category',
  'description',
  'status',
  'coverage',
  'created_at',
  'updated_at',
];

export const sportsRoutes = new Hono<{ Variables: TenantVariables }>();

sportsRoutes.get(
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
      table: 'sports',
      columns: SPORT_COLUMNS,
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
