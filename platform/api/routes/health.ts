/**
 * @platform/api/routes/health
 *
 * GET /api/health — liveness + dependency readiness for the API process.
 * Returns an overall status of 'ok' (all good) or 'degraded' (a dependency is
 * unhealthy) and a per-check breakdown. Deliberately leaks no system, version,
 * or environment details to the client.
 */

import { Hono } from 'hono';
import { query } from '../database/client.js';
import { loopForwardingEnabled } from '../loop.js';
import { sendOk } from '../http.js';
import { nowIso } from '../utils/index.js';

type CheckState = 'ok' | 'down';

interface HealthReport {
  status: 'ok' | 'degraded';
  checks: {
    api: CheckState;
    database: CheckState;
  };
  loop_forwarding: boolean;
  time: string;
}

export const healthRoutes = new Hono();

healthRoutes.get('/', async (c) => {
  let database: CheckState = 'down';
  try {
    await query('SELECT 1');
    database = 'ok';
  } catch {
    database = 'down';
  }

  const report: HealthReport = {
    status: database === 'ok' ? 'ok' : 'degraded',
    checks: { api: 'ok', database },
    loop_forwarding: loopForwardingEnabled(),
    time: nowIso(),
  };

  // 200 when healthy, 503 when a dependency is down (still a typed envelope).
  return sendOk(c, report, undefined, report.status === 'ok' ? 200 : 503);
});
