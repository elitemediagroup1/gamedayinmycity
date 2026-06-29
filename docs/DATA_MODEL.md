# GameDayInMyCity — Data Model

Conventions: every table has \`id\` (uuid), \`created_at\`, \`updated_at\`.
\`source\` in {provider, local, editorial}. \`coverage\` in {live, partial, rolling_out, none}.
\`status\` in {draft, published, archived}. Slugs are unique within their parent scope.

The homepage already consumes a slice of this model via the JSON files in /data
(sports.json, gameday.json, shop.json, coach.json) and data/states.js. Those files are the
seed/source for the corresponding tables below.

## sports
slug (unique, e.g. baseball) | name | category (team|individual|outdoor|combat|digital) |
icon | description | has_api_data (bool) | coverage | sort
> Seed: data/sports.json

## states
abbr (char2) | slug | name | tag | coach_note | betting_status (legal|limited|no) |
betting_label | betting_note | coverage
> Seed: data/states.js (window.GDIMC_STATES)

## cities
state_id (fk) | slug | name | url_key (unique, e.g. toms-river-nj) | lat | lng |
population | coverage | featured_sports (uuid[])

## leagues (mostly LOCAL)
slug | name | sport_id (fk) | level (youth|travel|middle_school|high_school|college|
semi_pro|pro|adult_rec) | city_id (fk) | state_id (fk) | age_range | season | website |
source | status

## teams
external_id (provider key when source=provider) | slug | name | sport_id | league_id |
level | city_id | source

## games
external_id | sport_id | home_team_id | away_team_id | venue_id | start_time |
status (scheduled|in_progress|final|postponed) | home_score | away_score | source |
stream_id (fk, future)
> Scores/status come from the provider adapter only. No client-side simulation
> (this replaces the randomized logic removed from js/main.js).

## venues (facilities)
slug | name | type (field|court|rink|diamond|pool|track|gym|stadium|cage|range) |
sport_ids (uuid[]) | city_id | address | lat | lng | amenities (jsonb) | source

## tournaments
slug | name | sport_id | level | city_id | state_id | start_date | end_date |
registration_url | organizer_partner_id (fk) | source | status

## camps
slug | name | sport_id | age_range | city_id | state_id | dates | price_range_label |
provider_partner_id (fk) | website | source | status

## trainers
slug | name | sport_ids (uuid[]) | city_id | specialties (text[]) | cert_label | website |
partner_id | source | status
> Real people/businesses -> require verified opt-in before publish.

## articles (guides / SEO silos)
slug (unique) | title | type (guide|rules|recruiting|nutrition|buying_guide|
betting_education) | body_md | sport_id | state_id | affiliate_category_id | status |
seo (jsonb: title, description, canonical)

## affiliate_categories (Shop)
slug | name | parent_sport_id (fk) | description | affiliate_links (jsonb[]: merchant,
url, label, disclosure) | coverage
> Seed: data/shop.json. affiliate_links empty => UI renders "Coming Soon", never a price.

## partners (sponsors / leagues / schools / broadcasters)
name | type (league|school|sponsor|affiliate|broadcaster|ticket|facility|photographer) |
city_id | state_id | contact_email | status (lead|active|paused) | tier

## waitlist_submissions
name | email (encrypted) | city | state | role (parent|coach|league|school|broadcaster|
official|recruiter|sponsor) | product (gameday_live|city_rollout|general) | consent (bool) |
source_page

## coach_queries (analytics + retrieval tuning)
query_text | intent (find_league|find_tournament|gear|rules|recruiting|nutrition|
betting_edu|tickets|streaming|gaming|other) | matched_resources (uuid[]) |
had_answer (bool) | session_id (anon) | created_at
> Seed of intents/answers: data/coach.json. Stores the query, not personal data;
> drives the editorial backlog (what content to build next).

## gameday_live_streams (future product)
team_id | game_id | owner_partner_id | visibility (public|invite) |
status (planned|scheduled|live|ended) | playback_url | created_at
> Empty until launch. UI shows the waitlist, never a fake "LIVE" badge.

## Relationships (summary)
sport -> leagues -> teams -> games -> venues; sport -> states -> cities;
sport -> articles & affiliate_categories; partners attach to cities/states/streams;
Coach reads all entities to answer; pages are generated per (sport x state x city).
