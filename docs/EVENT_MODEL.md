# Event Model

The canonical event contract for the Loop Core Event Platform. Every InMyCity
property emits events that conform to this single shape, so Loop can ingest,
correlate, and automate across all properties uniformly.

## The envelope

Every event carries the following fields (see `platform/events/Event.ts`):

| Field | Type | Notes |
| --- | --- | --- |
| `event_id` | string (UUID) | Unique per event instance. |
| `event_type` | enum | One of the catalogue below. |
| `platform_id` | string | The producing property (tenant root). |
| `tenant_id` | string | Sub-tenant; defaults to `platform_id`. |
| `user_id` | string \| null | Authenticated user, when known. |
| `session_id` | string \| null | Per-session id. |
| `anonymous_id` | string \| null | Pseudonymous visitor id. |
| `timestamp` | string (ISO-8601) | When the event occurred (UTC). |
| `source` | string | Producer surface: web, mobile, api, server, worker, system. |
| `resource_type` | string \| null | Subject category (city, partner, article, ...). |
| `resource_id` | string \| null | Subject id/slug. |
| `payload` | object | Structured business data. |
| `metadata` | object | Structured technical data (referrer, experiment, ...). |
| `version` | integer | Event-contract version (currently `1`). |
| `trace_id` | string | One logical request/flow. |
| `correlation_id` | string | Groups a chain of related events. |
| `intent` | enum | `low` \| `medium` \| `high` triage hint. |

Identity fields are pseudonymous and nullable. **Secrets must never be placed
in an event.**

## Event catalogue

The current vocabulary (extensible — appending is non-breaking):

`waitlist_submit`, `coach_query`, `search_query`, `page_view`, `city_interest`,
`sport_interest`, `affiliate_click`, `partner_click`, `partner_lead`,
`article_view`, `guide_view`, `video_play`, `livestream_interest`,
`ticket_click`, `travel_click`, `hotel_click`, `parking_click`,
`tailgate_click`, `facility_view`, `league_view`, `team_view`, `game_view`,
`user_signup`, `login`, `logout`, `notification_open`, `notification_click`.

## Intent defaults

High-intent actions (`waitlist_submit`, `partner_lead`, `user_signup`) default
to `high`; conversion-adjacent clicks and interest signals default to `medium`;
everything else defaults to `low`. Producers may override per event.

## Construction

Producers never hand-build the envelope. `createEvent(input)` fills ids, the
timestamp, the contract version, the default intent, and normalises optional
fields to their canonical nulls. The result is validated at the boundary by
`EventValidator` before it can enter the bus.

## Versioning

`version` is an integer major. Additive changes (new event types, new optional
payload keys) do not bump it. A breaking change to the envelope would increment
`EVENT_CONTRACT_VERSION` and consumers would branch on the field.
