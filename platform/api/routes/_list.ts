/**
 * @platform/api/routes/_list
 *
 * Generic, reusable list-query builder shared by every collection endpoint
 * (sports, states, cities, articles, and future resources). It enforces the
 * non-negotiable invariants in one place:
 *   - tenant scoping (platform_id = $1)
 *   - soft-delete exclusion (deleted_at IS NULL)
 *   - optional status / coverage filters
 *   - optional full-text search against the table's tsvector "search" column
 *   - stable pagination (LIMIT/OFFSET) with a total count for page metadata
 *
 * Adding a new listable resource requires no new query code — just a column
 * allow-list and the table name.
 */

import type { PlatformId } from '../../types/index.js';
import type { QueryResultRow } from 'pg';
import { query } from '../../database/client.js';
import { resolvePagination, buildPageMeta, type PaginationInput } from '../../utils/index.js';
import type { PageMeta } from '../../types/index.js';

export interface ListOptions {
  /** Physical table name. Caller-controlled constant — never user input. */
  table: string;
  /** Columns to return, in order. Caller-controlled constants. */
  columns: string[];
  /** Resolved tenant. */
  platformId: PlatformId;
  pagination: PaginationInput;
  status?: string;
  coverage?: string;
  /** Free-text search term applied to the table's tsvector "search" column. */
  q?: string;
  /** Extra WHERE fragments + their bound params (for resource-specific joins). */
  extraWhere?: { sql: string; params: unknown[] }[];
  /** Default ordering. Caller-controlled constant. */
  orderBy?: string;
}

export interface ListResult<T extends QueryResultRow> {
  rows: T[];
  meta: PageMeta;
}

/**
 * Execute a tenant-scoped, filtered, paginated list query and return both the
 * page of rows and the total count needed for pagination metadata.
 */
export async function listResource<T extends QueryResultRow>(opts: ListOptions): Promise<ListResult<T>> {
  const page = resolvePagination(opts.pagination);

  const where: string[] = ['platform_id = $1', 'deleted_at IS NULL'];
  const params: unknown[] = [opts.platformId];

  if (opts.status) {
    params.push(opts.status);
    where.push(`status = $${params.length}`);
  }
  if (opts.coverage) {
    params.push(opts.coverage);
    where.push(`coverage = $${params.length}`);
  }
  if (opts.q) {
    params.push(opts.q);
    where.push(`search @@ plainto_tsquery('english', $${params.length})`);
  }
  for (const extra of opts.extraWhere ?? []) {
    // Re-number placeholders in the fragment relative to current param count.
    const base = params.length;
    const fragment = extra.sql.replace(/\$(\d+)/g, (_m, n) => `$${base + Number(n)}`);
    where.push(fragment);
    params.push(...extra.params);
  }

  const whereSql = where.join(' AND ');
  const orderBy = opts.orderBy ?? 'name ASC';
  const cols = opts.columns.join(', ');

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${opts.table} WHERE ${whereSql}`,
    params,
  );
  const total = Number(countResult.rows[0]?.count ?? '0');

  const limitParam = params.length + 1;
  const offsetParam = params.length + 2;
  const rowsResult = await query<T>(
    `SELECT ${cols} FROM ${opts.table}
     WHERE ${whereSql}
     ORDER BY ${orderBy}
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    [...params, page.limit, page.offset],
  );

  return { rows: rowsResult.rows, meta: buildPageMeta(page, total) };
}
