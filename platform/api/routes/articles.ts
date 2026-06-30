/**
 * @platform/api/routes/articles
 *
 * GET /api/articles — list editorial content for the resolved tenant. Supports
 * the shared status / coverage / q / pagination filters plus an optional
 * ?kind=<kind> scope (e.g. 'guide', 'news'). Articles are ordered by their
 * publish date (most recent first), falling back to creation time.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { TenantVariables } from '../tenant.js';
import { getPlatformId } from '../tenant.js';
import { ArticleFilters } from '../validation.js';
import { listResource } from './_list.js';
import { sendOk, validationError } from '../http.js';

const ARTICLE_COLUMNS = [
  'id',
  'platform_id',
  'slug',
  'title',
  'excerpt',
  'kind',
  'author',
  'published_at',
  'status',
  'coverage',
  'created_at',
  'updated_at',
];

export const articlesRoutes = new Hono<{ Variables: TenantVariables }>();

articlesRoutes.get(
  '/',
  zValidator('query', ArticleFilters, (result, c) => {
    if (!result.success) {
      return validationError(c, 'Invalid query parameters', result.error.flatten());
    }
    return;
  }),
  async (c) => {
    const { page, per_page, status, coverage, q, kind } = c.req.valid('query');

    const extraWhere = kind
      ? [{ sql: 'kind = $1', params: [kind] }]
      : undefined;

    const result = await listResource({
      table: 'articles',
      columns: ARTICLE_COLUMNS,
      platformId: getPlatformId(c),
      pagination: { page, per_page },
      status,
      coverage,
      q,
      extraWhere,
      orderBy: 'published_at DESC NULLS LAST, created_at DESC',
    });
    return sendOk(c, result.rows, result.meta);
  },
);
