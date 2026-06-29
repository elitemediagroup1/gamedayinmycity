/**
 * @platform/database/healthcheck
 *
 * Health checks for the platform's external dependencies. Used by:
 *   - the API route GET /api/health
 *   - the npm "health" script for CI / ops smoke tests
 *
 * Each check is isolated and returns a structured result; one failing
 * dependency never throws past the aggregator, so a partial outage is
 * reported as "degraded" rather than crashing the checker.
 */

import { query, supabase } from './client.js';
import { cacheEnabled, env } from '../config/index.js';

export type CheckStatus = 'ok' | 'degraded' | 'down' | 'skipped';

export interface CheckResult {
  name: string;
  status: CheckStatus;
  latency_ms: number;
  detail?: string;
}

export interface HealthReport {
  status: CheckStatus;
  checked_at: string;
  checks: CheckResult[];
}

async function timed(name: string, fn: () => Promise<void>): Promise<CheckResult> {
  const start = Date.now();
  try {
    await fn();
    return { name, status: 'ok', latency_ms: Date.now() - start };
  } catch (err) {
    return {
      name,
      status: 'down',
      latency_ms: Date.now() - start,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkPostgres(): Promise<CheckResult> {
  return timed('postgres', async () => {
    const res = await query<{ ok: number }>('SELECT 1 AS ok');
    if (res.rows[0]?.ok !== 1) throw new Error('unexpected SELECT 1 result');
  });
}

async function checkMigrations(): Promise<CheckResult> {
  return timed('migrations', async () => {
    const res = await query<{ count: string }>('SELECT count(*)::text AS count FROM schema_migrations');
    if (Number(res.rows[0]?.count ?? 0) < 1) throw new Error('no migrations applied');
  });
}

async function checkSupabase(): Promise<CheckResult> {
  return timed('supabase', async () => {
    // A lightweight auth admin ping that requires the service role key to be valid.
    const { error } = await supabase().from('platforms').select('platform_id').limit(1);
    if (error) throw new Error(error.message);
  });
}

async function checkRedis(): Promise<CheckResult> {
  if (!cacheEnabled()) {
    return { name: 'redis', status: 'skipped', latency_ms: 0, detail: 'cache disabled or REDIS_URL unset' };
  }
  const start = Date.now();
  try {
    const { default: IORedis } = await import('ioredis');
    const client = new IORedis(env().REDIS_URL as string, { lazyConnect: true, maxRetriesPerRequest: 1 });
    await client.connect();
    const pong = await client.ping();
    await client.quit();
    if (pong !== 'PONG') throw new Error('unexpected PING reply: ' + pong);
    return { name: 'redis', status: 'ok', latency_ms: Date.now() - start };
  } catch (err) {
    // Redis is optional — a failure is "degraded", not "down".
    return {
      name: 'redis',
      status: 'degraded',
      latency_ms: Date.now() - start,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

function aggregate(checks: CheckResult[]): CheckStatus {
  if (checks.some((c) => c.status === 'down')) return 'down';
  if (checks.some((c) => c.status === 'degraded')) return 'degraded';
  return 'ok';
}

export async function runHealthChecks(): Promise<HealthReport> {
  const checks = await Promise.all([
    checkPostgres(),
    checkMigrations(),
    checkSupabase(),
    checkRedis(),
  ]);
  return {
    status: aggregate(checks),
    checked_at: new Date().toISOString(),
    checks,
  };
}

// CLI entrypoint: tsx database/healthcheck.ts
const invokedDirectly = process.argv[1]?.endsWith('healthcheck.ts') ?? false;
if (invokedDirectly) {
  runHealthChecks()
    .then((report) => {
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
      process.exitCode = report.status === 'down' ? 1 : 0;
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[health] checker crashed:', err);
      process.exitCode = 1;
    });
}
