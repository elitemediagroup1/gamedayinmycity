# GameDayInMyCity — Architecture

## What this is
GameDayInMyCity is being built as the **local-first operating system for sports**:
a directory + resource platform spanning youth, high school, college, pro, Olympics,
esports and gaming, plus gear guides, betting education, streaming (coming soon), and
**Coach**, an AI sports concierge. This document describes the technical foundation that
turns today's static site into a scalable platform.

## Guiding principles
1. **Static-first, API-backed.** The marketing/content surface stays static (fast, cheap,
   SEO-friendly, deployable on GitHub Pages). Dynamic data comes from *our own* API.
2. **Everything is an entity.** Sports, states, cities, leagues, teams, games, venues,
   articles, products, partners and Coach conversations are all first-class records.
   Pages, search and Coach are all generated from entities.
3. **Honesty doctrine (non-negotiable).** No fake scores, odds, prices, inventory, viewer
   counts or AI results. Every data surface carries a coverage flag
   (live | partial | rolling_out | none) and renders real data or an honest "coming soon".
4. **Never expose providers to the browser.** Third-party APIs (e.g. SportsDataIO) live
   server-side only, behind an adapter layer. The frontend calls our /api/* only.
5. **Local data is the moat.** Pro/college data is commodity; youth, HS, travel, camps,
   trainers and facilities are proprietary and stored in our own database.

## Current state (this PR)
- Static site: index.html + css/styles.css + js/main.js + data/*.
- Homepage content moved into structured JSON: data/sports.json, data/gameday.json,
  data/shop.json, data/coach.json (states remain in data/states.js).
- js/main.js renders the directory grids from JSON and runs an honest Coach (guidance +
  links, never fabricated results). All simulated/fake live logic has been removed:
  no randomized scores, no climbing viewer count, no fake odds flicker, no fake ticker.

## Target system layers
\`\`\`
CLIENT (static, pre-rendered pages)  ->  talks only to /api/*  (no vendor keys/urls)
        |
OUR API (Node/TypeScript, serverless or Fastify)
        |-- provider adapters (SportsDataIO, tickets, places, weather, news...)
        |-- local-sports services (Postgres)
        |-- Coach service (LLM + retrieval over our own entities)
        |-- waitlist / partner intake
        |
Postgres (entities) + Redis/KV (provider + computed caches)
\`\`\`

## Recommended stack (incremental, not a rewrite)
- Frontend: keep the static site; add a build step (Astro or Eleventy) to pre-render
  category/state/city pages from JSON/DB. Reuse css/styles.css untouched.
- API: Node + TypeScript on serverless (Vercel/Netlify) or small Fastify service.
- Database: Postgres (Supabase or Neon).
- Cache: Redis/Upstash or platform KV.
- Coach: server-side LLM call + retrieval over our content; cites real pages.

## Environments
- local: dev DB seed + provider REPLAY mode (recorded fixtures, no live calls).
- staging: real DB, sandbox provider keys, noindex.
- production: real keys, real data, honest empty-states for un-launched markets.

## The coverage contract
Every data endpoint returns a \`coverage\` field. The frontend renders real data for
live/partial and a truthful "Rolling Out / Coming Soon" for rolling_out/none. This single
mechanism is what keeps the platform honest as it scales to thousands of pages.

## Security & compliance posture
- Provider API keys: server env vars only; never in client bundles or URLs.
- Betting: education only at launch; odds gated by jurisdiction + feature flag, default OFF.
- Youth/minors: store org-level data, not children's PII; separate privacy review before
  any athlete-profile features.
- Waitlist PII: encrypted at rest, never shared with third parties.

See DATA_MODEL.md, API_SPEC.md and ROADMAP.md for specifics.
