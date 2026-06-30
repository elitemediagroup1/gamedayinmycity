/**
 * @platform/tests/api
 *
 * Integration tests for the v1 REST API. These exercise the real Hono app in
 * process (no network socket) against the CI Postgres service container, which
 * the workflow migrates and seeds before running the suite. They assert the
 * typed envelope contract, pagination, filtering, tenant resolution, and the
 * waitlist signup + native Loop event emission.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { app } from '../api/server.js';
import { query, closePool } from '../database/client.js';

const DB_TIMEOUT = 15_000;

afterAll(async () => {
  await closePool();
});

/** Helper: issue a request to the in-process app and parse the JSON body. */
async function call(path: string, init?: RequestInit) {
  const res = await app.request(path, init);
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

describe('GET /api/health', () => {
  it('reports an ok status with a database check', async () => {
    const { status, body } = await call('/api/health');
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    const data = body.data as Record<string, unknown>;
    expect(data.status).toBe('ok');
    expect((data.checks as Record<string, unknown>).database).toBe('ok');
  }, DB_TIMEOUT);
});

describe('GET /api/sports', () => {
  it('returns a typed, paginated list of seeded sports', async () => {
    const { status, body } = await call('/api/sports');
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect((body.data as unknown[]).length).toBeGreaterThanOrEqual(5);
    const meta = body.meta as Record<string, number>;
    expect(meta.page).toBe(1);
    expect(meta.per_page).toBe(20);
    expect(meta.total).toBeGreaterThanOrEqual(5);
  }, DB_TIMEOUT);

  it('respects pagination', async () => {
    const { body } = await call('/api/sports?page=1&per_page=2');
    expect((body.data as unknown[]).length).toBeLessThanOrEqual(2);
    expect((body.meta as Record<string, number>).per_page).toBe(2);
  }, DB_TIMEOUT);

  it('rejects an out-of-range per_page with a validation error', async () => {
    const { status, body } = await call('/api/sports?per_page=999');
    expect(status).toBe(400);
    expect(body.ok).toBe(false);
    expect((body.error as Record<string, string>).code).toBe('validation_error');
  }, DB_TIMEOUT);
});

describe('tenant resolution', () => {
  it('rejects an unknown platform id', async () => {
    const { status, body } = await call('/api/sports', {
      headers: { 'X-Platform-Id': 'not-a-tenant' },
    });
    expect(status).toBe(400);
    expect(body.ok).toBe(false);
    expect((body.error as Record<string, string>).code).toBe('tenant_invalid');
  }, DB_TIMEOUT);

  it('accepts the default tenant when no header is provided', async () => {
    const { status } = await call('/api/sports');
    expect(status).toBe(200);
  }, DB_TIMEOUT);
});

describe('GET /api/states', () => {
  it('returns seeded states', async () => {
    const { status, body } = await call('/api/states');
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect((body.data as unknown[]).length).toBeGreaterThanOrEqual(1);
  }, DB_TIMEOUT);
});

describe('GET /api/cities', () => {
  it('returns a typed list (possibly empty) with pagination meta', async () => {
    const { status, body } = await call('/api/cities');
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toBeDefined();
  }, DB_TIMEOUT);
});

describe('GET /api/articles', () => {
  it('returns a typed list (possibly empty) with pagination meta', async () => {
    const { status, body } = await call('/api/articles');
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  }, DB_TIMEOUT);
});

describe('POST /api/waitlist', () => {
  it('rejects an invalid email', async () => {
    const { status, body } = await call('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    expect(status).toBe(400);
    expect((body.error as Record<string, string>).code).toBe('validation_error');
  }, DB_TIMEOUT);

  it('records a signup and emits a waitlist_submit event', async () => {
    const email = `test+${Date.now()}@example.com`;
    const { status, body } = await call('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, interest: 'Basketball' }),
    });
    expect(status).toBe(201);
    expect(body.ok).toBe(true);
    expect((body.data as Record<string, string>).email).toBe(email);

    // The row exists, scoped to the default tenant.
    const row = await query<{ email: string }>(
      'SELECT email FROM waitlist WHERE platform_id = $1 AND email = $2',
      ['gameday', email],
    );
    expect(row.rows).toHaveLength(1);

    // A native Loop event was recorded for the signup.
    const events = await query<{ event_type: string }>(
      `SELECT event_type FROM platform_events
       WHERE platform_id = $1 AND event_type = 'waitlist_submit'
       ORDER BY created_at DESC LIMIT 1`,
      ['gameday'],
    );
    expect(events.rows.length).toBeGreaterThanOrEqual(1);
    expect(events.rows[0].event_type).toBe('waitlist_submit');
  }, DB_TIMEOUT);
});
