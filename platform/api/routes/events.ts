/**
 * @platform/api/routes/events
 *
 * GET /api/events/health - observability for the Loop event bus. Reports the
 * delivery queue depth, failure/retry counters, last publish/retry instants,
 * Loop transport connectivity, and database connectivity. Leaks no system,
 * version, or environment details to the client.
 */

import { Hono } from 'hono';
import { query } from '../../database/client.js';
import { getEventBus, loopForwardingEnabled } from '../../events/EventPublisher.js';
import { sendOk } from '../http.js';
import { nowIso } from '../../utils/index.js';

type CheckState = 'ok' | 'down';

interface EventsHealthReport {
  status: 'ok' | 'degraded';
  queue: {
    depth: number;
    in_flight: number;
    delivered: number;
    retried: number;
    failed: number;
    dead_lettered: number;
    last_publish_at: string | null;
    last_retry_at: string | null;
    running: boolean;
  };
  checks: {
    database: CheckState;
    loop_adapter: CheckState;
  };
  loop_forwarding: boolean;
  adapter: string;
  time: string;
}

export const eventsRoutes = new Hono();

eventsRoutes.get('/health', async (c) => {
  const bus = getEventBus();

  let database: CheckState = 'down';
  try {
    await query('SELECT 1');
    database = 'ok';
  } catch {
    database = 'down';
  }

  let loopAdapter: CheckState = 'down';
  try {
    loopAdapter = (await bus.adapterHealthy()) ? 'ok' : 'down';
  } catch {
    loopAdapter = 'down';
  }

  const metrics = await bus.metrics();

  const report: EventsHealthReport = {
    status: database === 'ok' && loopAdapter === 'ok' ? 'ok' : 'degraded',
    queue: {
      depth: metrics.depth,
      in_flight: metrics.in_flight,
      delivered: metrics.delivered,
      retried: metrics.retried,
      failed: metrics.failed,
      dead_lettered: metrics.dead_lettered,
      last_publish_at: metrics.last_publish_at,
      last_retry_at: metrics.last_retry_at,
      running: metrics.running,
    },
    checks: {
      database,
      loop_adapter: loopAdapter,
    },
    loop_forwarding: loopForwardingEnabled(),
    adapter: bus.adapterName,
    time: nowIso(),
  };

  return sendOk(c, report);
});
