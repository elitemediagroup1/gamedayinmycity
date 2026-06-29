# GameDayInMyCity — API Spec (v1)

Base: \`/api\` (versioned as \`/api/v1\` once stable). JSON only.
Read endpoints are public + cached. Write endpoints (\`/coach\`, \`/waitlist\`, \`/partners\`)
are rate-limited with CSRF protection. Admin endpoints sit behind auth.

## Standard envelope
\`\`\`json
{
  "data": {},
  "coverage": "live|partial|rolling_out|none",
  "meta": { "cached": true, "updatedAt": "ISO8601", "source": "provider|local|editorial" }
}
\`\`\`
Errors: \`{ "error": { "code": "string", "message": "human readable" } }\` + HTTP status.

**Honesty rule:** if real data is unavailable, return \`coverage:"rolling_out"\` with
\`data:[]\`. Never fabricate. The client renders the truthful empty-state.

## Read endpoints
| Method | Path | Query | Returns |
|---|---|---|---|
| GET | /api/sports | category, coverage | sport hubs (powers #sportGrid) |
| GET | /api/sports/:slug | | one sport + child states coverage |
| GET | /api/states | | rollout list (powers #states) |
| GET | /api/states/:slug | | state detail (cities, betting status) |
| GET | /api/cities | state, q | city directory |
| GET | /api/cities/:urlKey | | city hub (leagues, venues, sports) |
| GET | /api/leagues | sport, state, city, level | local leagues (paged) |
| GET | /api/teams | sport, league, level, city | teams |
| GET | /api/games | sport, team, date, status | schedule/scores (provider-backed) |
| GET | /api/facilities | sport, city, type | venues |
| GET | /api/tournaments | sport, state, from, to | tournaments |
| GET | /api/shop-categories | sport | affiliate hubs (powers #shopGrid; no fake prices) |
| GET | /api/shop-categories/:slug | | category + real affiliate links or empty |
| GET | /api/articles | type, sport, state | guides index |
| GET | /api/articles/:slug | | single guide |

## Write / interactive endpoints
### POST /api/coach
Request:
\`\`\`json
{ "query": "find a youth league near me", "city": "toms-river-nj", "sessionId": "anon-uuid" }
\`\`\`
Response:
\`\`\`json
{
  "answer": "Here's how to find that and what to look for...",
  "intent": "find_league",
  "resources": [
    { "type": "sport", "slug": "baseball", "url": "/sports/baseball/new-jersey/toms-river/" }
  ],
  "coverage": "partial",
  "disclaimer": "Coach guides you to real resources. It does not invent scores, odds, or listings."
}
\`\`\`
Rules: Coach never returns fabricated scores, odds, prices or listings. It answers from
published content + live /api data and links to real pages; if coverage is missing it says
so and offers the waitlist. Logs to coach_queries (query only). The current homepage uses
data/coach.json as the offline stand-in for this endpoint.

### POST /api/waitlist
\`\`\`json
{ "name": "", "email": "", "city": "", "state": "", "role": "parent",
  "product": "gameday_live", "consent": true, "sourcePage": "#live" }
\`\`\`
-> 201 { "data": { "id": "uuid" }, "message": "You're on the list." }
Requires consent:true. Confirmation via transactional email. No third-party sharing.
(The #live form on the homepage is wired to call this once the backend exists; until then
it shows an honest "not submitted yet" message.)

### POST /api/partners
Lead intake; subset of the partners table. status defaults to \`lead\`.

## Provider isolation rule (critical)
No endpoint proxies a third-party provider verbatim. All provider data passes through the
adapter layer, is normalized to our schema, cached, and reshaped. The browser never sees a
vendor hostname, key, or raw payload. See ARCHITECTURE.md for the adapter design.

## Caching guidance
scores 15-30s | schedules 10min | standings 1h | teams/players 24h |
sports/states/cities (mostly static) edge-cached with revalidation.
