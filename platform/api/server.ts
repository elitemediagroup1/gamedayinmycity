/**
 * @platform/api/server
 *
 * The GameDay Platform HTTP API (Hono). This is the single backend that serves
 * every InMyCity property; the frontend never talks to providers or the
 * database directly. Routes are mounted under /api and every request is scoped
 * to a tenant by the tenantResolver middleware.
 *
 * The Hono `app` is exported for in-process testing; the Node server is only
 * started when this module is executed directly (npm run dev / start).
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';

import { env } from '../config/index.js';
import { tenantResolver, type TenantVariables } from './tenant.js';
import { sendError, ERROR_CODES, notFound } from './http.js';

import { healthRoutes } from './routes/health.js';
import { sportsRoutes } from './routes/sports.js';
import { statesRoutes } from './routes/states.js';
import { citiesRoutes } from './routes/cities.js';
import { articlesRoutes } from './routes/articles.js';
import { waitlistRoutes } from './routes/waitlist.js';
import { eventsRoutes } from './routes/events.js';

export const app = new Hono<{ Variables: TenantVariables }>();

app.use('*', logger());
app.use('*', cors());

// Tenant resolution applies to all data routes (health is tenant-agnostic but
// the middleware is cheap and still validates any explicit platform override).
app.use('/api/*', tenantResolver());

const api = new Hono<{ Variables: TenantVariables }>();
api.route('/health', healthRoutes);
api.route('/sports', sportsRoutes);
api.route('/states', statesRoutes);
api.route('/cities', citiesRoutes);
api.route('/articles', articlesRoutes);
api.route('/waitlist', waitlistRoutes);
api.route('/events', eventsRoutes);

app.route('/api', api);

// 404 for anything else, in the standard error envelope.
app.notFound((c) => notFound(c, 'Route not found'));

// Centralised error handler so unexpected throws never leak stack traces.
app.onError((err, c) => {
  return sendError(
    c,
    ERROR_CODES.INTERNAL,
    'Internal server error',
    err instanceof Error ? err.message : undefined,
  );
});

// Start the Node server only when run directly (not when imported by tests).
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === `file://${process.argv[1]}`;

if (isDirectRun) {
  const e = env();
  const port = e.PORT;
  serve({ fetch: app.fetch, port }, (info) => {
    // eslint-disable-next-line no-console
    console.log(`[api] GameDay Platform API listening on :${info.port}`);
  });
}

export default app;
