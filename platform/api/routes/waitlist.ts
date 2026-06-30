/**
 * @platform/api/routes/waitlist
 *
 * POST /api/waitlist — capture a waitlist signup for the resolved tenant and
 * emit a native EMG Loop `waitlist_submit` event. The DB write and the event
 * emission happen in a single transaction so an interested lead is never
 * recorded without a corresponding Loop event (and vice versa).
 *
 * Idempotent on (platform_id, email): a repeat signup updates the existing row
 * rather than creating duplicates, and still emits a fresh intent event.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { TenantVariables } from '../tenant.js';
import { getPlatformId } from '../tenant.js';
import { WaitlistBody } from '../validation.js';
import { sendOk, sendError, validationError, ERROR_CODES } from '../http.js';
import { withTransaction } from '../../database/client.js';
import { buildLoopEvent } from '../../shared/index.js';

export const waitlistRoutes = new Hono<{ Variables: TenantVariables }>();

waitlistRoutes.post(
  '/',
  zValidator('json', WaitlistBody, (result, c) => {
    if (!result.success) {
      return validationError(c, 'Invalid request body', result.error.flatten());
    }
    return;
  }),
  async (c) => {
    const platformId = getPlatformId(c);
    const { email, interest, city, session_id } = c.req.valid('json');

    try {
      const created = await withTransaction(async (client) => {
        // Resolve an optional city slug to its id within this tenant.
        let cityId: string | null = null;
        if (city) {
          const cityResult = await client.query<{ id: string }>(
            `SELECT id FROM cities
             WHERE platform_id = $1 AND slug = $2 AND deleted_at IS NULL
             LIMIT 1`,
            [platformId, city],
          );
          cityId = cityResult.rows[0]?.id ?? null;
        }

        // Upsert the waitlist entry (idempotent per tenant + email).
        const waitlistResult = await client.query<{ id: string; created_at: string }>(
          `INSERT INTO waitlist (platform_id, email, interest, city_id, source)
           VALUES ($1, $2, $3, $4, 'api')
           ON CONFLICT (platform_id, email, interest) DO UPDATE
             SET city_id  = COALESCE(EXCLUDED.city_id, waitlist.city_id),
                 updated_at = now(),
                 deleted_at = NULL
           RETURNING id, created_at`,
          [platformId, email, interest ?? null, cityId],
        );
        const entry = waitlistResult.rows[0];

        // Emit the native Loop event inside the same transaction.
        const event = buildLoopEvent({
          platform_id: platformId,
          event_type: 'waitlist_submit',
          session_id: session_id ?? null,
          subject_type: city ? 'city' : null,
          subject_id: cityId,
          payload: { interest: interest ?? null, has_city: Boolean(cityId) },
          source: 'api',
        });
        await client.query(
          `INSERT INTO platform_events
             (platform_id, event_type, intent, actor_id, session_id,
              subject_type, subject_id, payload, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
          [
            event.platform_id,
            event.event_type,
            event.intent,
            event.actor_id,
            event.session_id,
            event.subject_type,
            event.subject_id,
            JSON.stringify(event.payload),
            event.source,
          ],
        );

        return entry;
      });

      return sendOk(c, { id: created.id, email, status: 'subscribed' }, undefined, 201);
    } catch (err) {
      return sendError(
        c,
        ERROR_CODES.INTERNAL,
        'Failed to record waitlist signup',
        err instanceof Error ? err.message : undefined,
      );
    }
  },
);
