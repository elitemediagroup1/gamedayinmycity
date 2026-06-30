/**
 * @platform/events/LoopPublisher
 *
 * The first EMG Loop adapter. The contract is intentionally narrow: a Loop
 * adapter receives a canonical {@link PlatformEvent} and durably hands it to
 * Loop. Application code never knows or cares where events ultimately go.
 *
 * In this v1 the adapter writes to the database (the `platform_events`
 * ingestion table). Because the same {@link LoopAdapter} interface can be
 * implemented by a RabbitMQ / Kafka / Redis Streams / NATS / SQS / Pub-Sub
 * driver later, swapping transports requires zero changes to publishers.
 *
 * Mapping note: the persisted `loop_event_type` enum is a small, stable set.
 * The richer canonical catalogue is mapped down onto it via DB_EVENT_TYPE_MAP,
 * and the *complete* canonical envelope is preserved inside the row payload so
 * nothing is lost. This lets the event vocabulary grow without DB migrations.
 */

import { query } from '../database/client.js';
import { loopEnabled } from '../config/index.js';
import type { PlatformEvent } from './Event.js';
import type { EventType } from './EventTypes.js';

/** Outcome of a single publish attempt. */
export interface PublishOutcome {
  delivered: boolean;
  /** Adapter-assigned id for the persisted/forwarded record, when available. */
  ref: string | null;
}

/** The generic Loop adapter contract every transport implements. */
export interface LoopAdapter {
  readonly name: string;
  publish(event: PlatformEvent): Promise<PublishOutcome>;
  healthy(): Promise<boolean>;
}

/**
 * Persisted enum values supported by the `platform_events.event_type` column.
 * Keep in sync with the database `loop_event_type` enum.
 */
type DbEventType =
  | 'waitlist_submit'
  | 'coach_query'
  | 'partner_lead'
  | 'affiliate_click'
  | 'search_query'
  | 'city_interest'
  | 'sport_interest'
  | 'live_stream_interest'
  | 'form_submit'
  | 'content_view';

/**
 * Map every canonical event type onto a persisted enum value. New, unmapped
 * types degrade to 'content_view' (a neutral catch-all) while the original
 * type is always retained in the payload under `event_type`.
 */
const DB_EVENT_TYPE_MAP: Record<EventType, DbEventType> = {
  waitlist_submit: 'waitlist_submit',
  coach_query: 'coach_query',
  search_query: 'search_query',
  page_view: 'content_view',
  city_interest: 'city_interest',
  sport_interest: 'sport_interest',
  affiliate_click: 'affiliate_click',
  partner_click: 'partner_lead',
  partner_lead: 'partner_lead',
  article_view: 'content_view',
  guide_view: 'content_view',
  video_play: 'content_view',
  livestream_interest: 'live_stream_interest',
  ticket_click: 'affiliate_click',
  travel_click: 'affiliate_click',
  hotel_click: 'affiliate_click',
  parking_click: 'affiliate_click',
  tailgate_click: 'affiliate_click',
  facility_view: 'content_view',
  league_view: 'content_view',
  team_view: 'content_view',
  game_view: 'content_view',
  user_signup: 'form_submit',
  login: 'content_view',
  logout: 'content_view',
  notification_open: 'content_view',
  notification_click: 'content_view',
};

/** Translate a canonical event type to its persisted enum value. */
export function toDbEventType(type: EventType): DbEventType {
  return DB_EVENT_TYPE_MAP[type] ?? 'content_view';
}

/**
 * Database-backed Loop adapter. Persists each event into `platform_events`,
 * storing the full canonical envelope in the JSONB payload so no field is
 * dropped by the enum down-mapping.
 */
export class LoopPublisher implements LoopAdapter {
  readonly name = 'database';

  async publish(event: PlatformEvent): Promise<PublishOutcome> {
    const dbType = toDbEventType(event.event_type);
    const enrichedPayload = {
      ...event.payload,
      __event: {
        event_id: event.event_id,
        event_type: event.event_type,
        tenant_id: event.tenant_id,
        user_id: event.user_id,
        anonymous_id: event.anonymous_id,
        timestamp: event.timestamp,
        version: event.version,
        trace_id: event.trace_id,
        correlation_id: event.correlation_id,
        metadata: event.metadata,
      },
    };

    const sql =
      'INSERT INTO platform_events ' +
      '(platform_id, event_type, intent, actor_id, session_id, ' +
      'subject_type, subject_id, payload, source) ' +
      'VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9) RETURNING id';

    const params = [
      event.platform_id,
      dbType,
      event.intent,
      event.user_id,
      event.session_id,
      event.resource_type,
      event.resource_id,
      JSON.stringify(enrichedPayload),
      event.source,
    ];

    const result = await query<{ id: string }>(sql, params);
    const ref = result.rows[0]?.id ?? null;
    return { delivered: true, ref };
  }

  /** Readiness probe: a trivial round-trip to the database. */
  async healthy(): Promise<boolean> {
    try {
      await query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Whether external Loop forwarding (to a broker/HTTP ingest) is enabled. The
 * native DB contract is always on; external forwarding stays gated behind
 * config until a real transport adapter ships.
 */
export function loopForwardingEnabled(): boolean {
  return loopEnabled();
}
