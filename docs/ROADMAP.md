# GameDayInMyCity — Roadmap

## Where we are (this PR: Honest MVP Platform Foundation)
- Removed all fake/simulated data from the live site (no fake scores, teams, viewer
  counts, odds, product prices, or fabricated Coach answers).
- Moved homepage content into structured JSON: data/sports.json, data/gameday.json,
  data/shop.json, data/coach.json.
- Refactored js/main.js to render directory grids from JSON, route search to hubs, and run
  an honest Coach (guidance + real links). States still load from data/states.js.
- Added architecture docs: ARCHITECTURE.md, DATA_MODEL.md, API_SPEC.md, ROADMAP.md.
- Design, layout, typography and styling are unchanged.

## Provider adapter plan (SportsDataIO is just the first provider)
A single internal interface; providers are swappable; the frontend never sees them.
\`\`\`
api/providers/
  sportsdataio/  client.ts (key from env) | map.ts (vendor -> our schema) | endpoints.ts | fixtures/
  index.ts       provider registry + feature flags
api/services/    schedules.ts | scores.ts | standings.ts | odds.ts (gated by legality)
\`\`\`
Interface: getSchedules, getScores, getStandings, getTeams, getPlayers, getNews,
getOdds (returns null unless legal + flag on), mode: "live" | "replay".
Replay mode reads fixtures/ (zero external calls) for local/staging/tests.

## SEO URL structure (static-rendered, sitemap-driven)
\`\`\`
/                                          homepage
/sports/                                   all sports
/sports/baseball/                          sport hub
/sports/baseball/new-jersey/               sport x state
/sports/baseball/new-jersey/toms-river/    sport x state x city
/states/new-jersey/                        state rollout
/cities/toms-river-nj/                     city hub
/guides/betting-basics/                    education silo
/shop/baseball-gloves/                     affiliate category hub
/live/                                     GameDay Live + waitlist
/partners/                                 partner program
\`\`\`
Every (sport x state x city) is a template, not a hand-built page -> scales to 100k+ pages.
Un-launched combos render an honest "Rolling Out" page (still indexable).

## Build order — next 10 tasks
1. Stand up Postgres + schema (DATA_MODEL.md); seed states from data/states.js.
2. (DONE in this PR) Extract homepage data -> JSON; de-fake js/main.js.
3. Create API skeleton: /api/sports, /api/states, /api/cities (envelope + coverage).
4. SportsDataIO adapter in REPLAY mode (fixtures) + /api/games, /api/teams.
5. Switch adapter to live keys behind a flag; cache /api/games. Real data where covered.
6. Static page generator (Astro/Eleventy) for /sports, /states, /cities + sitemap.xml.
7. /api/coach v1: intent + retrieval over guides/sports/cities; wire homepage Coach to it.
8. /api/waitlist + /api/partners: real persistence, consent, confirmation email; wire forms.
9. Affiliate category hubs (/api/shop-categories, /shop/:slug) with real-links-or-empty.
10. Admin/CMS for sports, city/state coverage, guides, affiliate links, partners, waitlist.

## Admin / CMS (editable without code)
sports categories | state & city pages + coverage flags | guides (markdown) | affiliate
categories + links | partners/sponsors | facilities | local leagues/tournaments/camps/
trainers | waitlist export | coach_queries triage (content-gap backlog).
MVP: Postgres + lightweight admin (Supabase Studio, Directus, or Strapi).

## Frontend file changes already made (reference)
- index.html: honest copy; new section IDs (#sportGrid, #gamedayGrid, #shopGrid,
  #gameday, .waitlist, .chipf filters, #navSearch); additive <style> block (no styles.css
  change).
- js/main.js: JSON-driven rendering; search routing; honest Coach; removed all simulation.
- data/*.json: new structured content sources.

## Honesty guardrails (must hold at every stage)
- coverage flag on every data surface; never fabricate.
- providers server-side only.
- betting education-only until legal review; default OFF, jurisdiction-gated.
- minors' data handled separately with privacy review before any athlete profiles.
