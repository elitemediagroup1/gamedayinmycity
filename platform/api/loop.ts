/**
 * @platform/api/loop
 *
 * EMG Loop integration point. Every high-intent action on any InMyCity property
 * is recorded as a row in platform_events so Loop can ingest, attribute, and
 * route it later. This module is the single, native emission path used by the
 * API; routes never write platform_events directly.
 *
 * For now we durably persist events to the database (the system of record).
 * Forwarding to an external Loop ingest endpoint is gated behind loopEnabled()
 * and intentionally deferred — the contract and storage are native from day one
 * so wiring the transport later requires no schema or call-site changes.
 */

import { buildLoopEvent, type LoopEventInput } from '../shared/index.js';
import { query } from '../database/client.js';
import { loopEnabled } from '../config/index.js';

/**
 * Record a platform event. Returns the inserted row id. Designed to be awaited
 * inside request handlers; failures are surfaced to the caller so the route can
 * decide whether the event is critical to the response.
 */
export async function emitEvent(input: LoopEventInput): Promise<string> {
  const event = buildLoopEvent(input);

  const result = await query<{ id: string }>(
    `INSERT INTO platform_events
       (platform_id, event_type, intent, actor_id, session_id,
        subject_type, subject_id, payload, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
     RETURNING id`,
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

  return result.rows[0].id;
}

/**
 * Whether outbound forwarding to the external Loop service is active. Routes do
 * not need this today (persistence is unconditional) but it is exported so the
 * future transport layer and health checks can report Loop wiring status.
 */
export function loopForwardingEnabled(): boolean {
  return loopEnabled();
}
