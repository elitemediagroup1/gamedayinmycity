/**
 * @platform/database/client
 *
 * Connection helpers for the platform.
 *
 *  - pgPool():     a pooled node-postgres client for the API (read/write).
 *  - query():      typed convenience wrapper around pool.query.
 *  - supabase():   server-side Supabase client using the service-role key.
 *                  Server-only; never import this into any frontend bundle.
 *  - closePool():  graceful shutdown for tests and SIGTERM handlers.
 *
 * Secrets come exclusively from validated env (see @platform/config).
 */

import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/index.js';

// ---------------------------------------------------------------------------
// Postgres pool (singleton)
// ---------------------------------------------------------------------------

let pool: Pool | null = null;

export function pgPool(): Pool {
  if (pool) return pool;
  const e = env();
  pool = new Pool({
    connectionString: e.DATABASE_URL,
    // Supabase requires TLS. In production reject-unauthorized is on by default.
    ssl: /localhost|127\.0\.0\.1/.test(e.DATABASE_URL) ? false : { rejectUnauthorized: e.NODE_ENV === 'production' },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on('error', (err: Error) => {
    // Never crash the process on an idle client error; log and continue.
    // eslint-disable-next-line no-console
    console.error('[db] idle client error:', err.message);
  });
  return pool;
}

/**
 * Run a parameterised query. Always use $1, $2, ... placeholders — never string
 * interpolation — to prevent SQL injection.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: ReadonlyArray<unknown> = [],
): Promise<QueryResult<T>> {
  const client = pgPool();
  return client.query<T>(text, params as unknown[]);
}

/** Run a function inside a transaction, rolling back on any error. */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pgPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// ---------------------------------------------------------------------------
// Supabase (server-side, service role)
// ---------------------------------------------------------------------------

let supabaseClient: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (supabaseClient) return supabaseClient;
  const e = env();
  supabaseClient = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return supabaseClient;
}

/** Reset cached clients. Test-only helper. */
export function resetClients(): void {
  supabaseClient = null;
}
