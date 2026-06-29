-- ===========================================================================
-- Migration 0001 — GameDay Platform Foundation
-- ---------------------------------------------------------------------------
-- Platform-first, multi-tenant (shared-schema) foundation for every InMyCity
-- property. Tenancy is enforced by a platform_id column on every domain row.
--
-- Conventions applied to EVERY domain table:
--   * id            uuid primary key (gen_random_uuid())
--   * platform_id   tenant scope (FK -> platforms.id semantics via slug)
--   * slug          url-safe key, unique per (platform_id, <type>)
--   * status        draft | published | archived | pending
--   * coverage      live | rolling_out | planned | paused
--   * source        provenance string (manual, sportsdataio, import, ...)
--   * metadata      jsonb, default '{}'
--   * search        tsvector generated column for full-text search
--   * created_at / updated_at / deleted_at  (soft delete + audit)
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- trigram search on slugs/names

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE entity_status AS ENUM ('draft', 'published', 'archived', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE coverage_state AS ENUM ('live', 'rolling_out', 'planned', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE loop_event_type AS ENUM (
    'waitlist_submit', 'coach_query', 'partner_lead', 'affiliate_click',
    'search_query', 'city_interest', 'sport_interest', 'live_stream_interest',
    'form_submit', 'content_view'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE loop_intent AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current on every UPDATE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Tenancy registry: one row per InMyCity property
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platforms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id text NOT NULL UNIQUE,         -- stable slug: 'gameday', 'care', ...
  name        text NOT NULL,
  domain      text,
  status      entity_status NOT NULL DEFAULT 'draft',
  coverage    coverage_state NOT NULL DEFAULT 'planned',
  source      text DEFAULT 'manual',
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_platforms_status ON platforms (status) WHERE deleted_at IS NULL;
DROP TRIGGER IF EXISTS trg_platforms_updated_at ON platforms;
CREATE TRIGGER trg_platforms_updated_at BEFORE UPDATE ON platforms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- States
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS states (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id text NOT NULL REFERENCES platforms (platform_id) ON DELETE CASCADE,
  slug        text NOT NULL,
  name        text NOT NULL,
  code        text,                          -- e.g. 'NJ'
  status      entity_status NOT NULL DEFAULT 'draft',
  coverage    coverage_state NOT NULL DEFAULT 'planned',
  source      text DEFAULT 'manual',
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  search      tsvector GENERATED ALWAYS AS (
                to_tsvector('english', coalesce(name, '') || ' ' || coalesce(code, ''))
              ) STORED,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (platform_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_states_platform ON states (platform_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_states_status   ON states (platform_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_states_search   ON states USING gin (search);
DROP TRIGGER IF EXISTS trg_states_updated_at ON states;
CREATE TRIGGER trg_states_updated_at BEFORE UPDATE ON states
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Cities
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id text NOT NULL REFERENCES platforms (platform_id) ON DELETE CASCADE,
  state_id    uuid REFERENCES states (id) ON DELETE SET NULL,
  slug        text NOT NULL,
  name        text NOT NULL,
  status      entity_status NOT NULL DEFAULT 'draft',
  coverage    coverage_state NOT NULL DEFAULT 'planned',
  source      text DEFAULT 'manual',
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  search      tsvector GENERATED ALWAYS AS (
                to_tsvector('english', coalesce(name, ''))
              ) STORED,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (platform_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_cities_platform ON cities (platform_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cities_state    ON cities (state_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cities_status   ON cities (platform_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cities_search   ON cities USING gin (search);
DROP TRIGGER IF EXISTS trg_cities_updated_at ON cities;
CREATE TRIGGER trg_cities_updated_at BEFORE UPDATE ON cities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Sports (category hubs) — GameDay-specific but platform-scoped
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id text NOT NULL REFERENCES platforms (platform_id) ON DELETE CASCADE,
  slug        text NOT NULL,
  name        text NOT NULL,
  category    text,                          -- team | individual | outdoor | combat | esports
  description text,
  status      entity_status NOT NULL DEFAULT 'draft',
  coverage    coverage_state NOT NULL DEFAULT 'planned',
  source      text DEFAULT 'manual',
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  search      tsvector GENERATED ALWAYS AS (
                to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
              ) STORED,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (platform_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_sports_platform ON sports (platform_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sports_category ON sports (platform_id, category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sports_search   ON sports USING gin (search);
DROP TRIGGER IF EXISTS trg_sports_updated_at ON sports;
CREATE TRIGGER trg_sports_updated_at BEFORE UPDATE ON sports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Leagues
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leagues (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id text NOT NULL REFERENCES platforms (platform_id) ON DELETE CASCADE,
  sport_id    uuid REFERENCES sports (id) ON DELETE SET NULL,
  city_id     uuid REFERENCES cities (id) ON DELETE SET NULL,
  slug        text NOT NULL,
  name        text NOT NULL,
  level       text,                          -- youth | high_school | college | pro | rec
  status      entity_status NOT NULL DEFAULT 'draft',
  coverage    coverage_state NOT NULL DEFAULT 'planned',
  source      text DEFAULT 'manual',
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  search      tsvector GENERATED ALWAYS AS (
                to_tsvector('english', coalesce(name, ''))
              ) STORED,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (platform_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_leagues_platform ON leagues (platform_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leagues_sport    ON leagues (sport_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leagues_city     ON leagues (city_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leagues_search   ON leagues USING gin (search);
DROP TRIGGER IF EXISTS trg_leagues_updated_at ON leagues;
CREATE TRIGGER trg_leagues_updated_at BEFORE UPDATE ON leagues
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Facilities
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facilities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id text NOT NULL REFERENCES platforms (platform_id) ON DELETE CASCADE,
  city_id     uuid REFERENCES cities (id) ON DELETE SET NULL,
  slug        text NOT NULL,
  name        text NOT NULL,
  kind        text,                          -- field | court | rink | gym | pool
  address     text,
  status      entity_status NOT NULL DEFAULT 'draft',
  coverage    coverage_state NOT NULL DEFAULT 'planned',
  source      text DEFAULT 'manual',
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  search      tsvector GENERATED ALWAYS AS (
                to_tsvector('english', coalesce(name, '') || ' ' || coalesce(address, ''))
              ) STORED,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (platform_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_facilities_platform ON facilities (platform_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_facilities_city     ON facilities (city_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_facilities_search   ON facilities USING gin (search);
DROP TRIGGER IF EXISTS trg_facilities_updated_at ON facilities;
CREATE TRIGGER trg_facilities_updated_at BEFORE UPDATE ON facilities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Articles / content
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS articles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id  text NOT NULL REFERENCES platforms (platform_id) ON DELETE CASCADE,
  slug         text NOT NULL,
  title        text NOT NULL,
  excerpt      text,
  body         text,
  kind         text DEFAULT 'article',       -- article | guide
  author       text,
  published_at timestamptz,
  status       entity_status NOT NULL DEFAULT 'draft',
  coverage     coverage_state NOT NULL DEFAULT 'planned',
  source       text DEFAULT 'manual',
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  search       tsvector GENERATED ALWAYS AS (
                 to_tsvector('english',
                   coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(body, ''))
               ) STORED,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  UNIQUE (platform_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_articles_platform  ON articles (platform_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_articles_status    ON articles (platform_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles (platform_id, published_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_articles_search    ON articles USING gin (search);
DROP TRIGGER IF EXISTS trg_articles_updated_at ON articles;
CREATE TRIGGER trg_articles_updated_at BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Partners
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partners (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id text NOT NULL REFERENCES platforms (platform_id) ON DELETE CASCADE,
  slug        text NOT NULL,
  name        text NOT NULL,
  website     text,
  tier        text,                          -- founding | standard | affiliate
  status      entity_status NOT NULL DEFAULT 'draft',
  coverage    coverage_state NOT NULL DEFAULT 'planned',
  source      text DEFAULT 'manual',
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  search      tsvector GENERATED ALWAYS AS (
                to_tsvector('english', coalesce(name, ''))
              ) STORED,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (platform_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_partners_platform ON partners (platform_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_partners_search   ON partners USING gin (search);
DROP TRIGGER IF EXISTS trg_partners_updated_at ON partners;
CREATE TRIGGER trg_partners_updated_at BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Affiliate categories (Shop hubs — honest, no fake prices)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS affiliate_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id text NOT NULL REFERENCES platforms (platform_id) ON DELETE CASCADE,
  slug        text NOT NULL,
  name        text NOT NULL,
  description text,
  status      entity_status NOT NULL DEFAULT 'draft',
  coverage    coverage_state NOT NULL DEFAULT 'planned',
  source      text DEFAULT 'manual',
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  search      tsvector GENERATED ALWAYS AS (
                to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
              ) STORED,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (platform_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_affcat_platform ON affiliate_categories (platform_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_affcat_search   ON affiliate_categories USING gin (search);
DROP TRIGGER IF EXISTS trg_affcat_updated_at ON affiliate_categories;
CREATE TRIGGER trg_affcat_updated_at BEFORE UPDATE ON affiliate_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Waitlist (GameDay Live + general)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS waitlist (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id  text NOT NULL REFERENCES platforms (platform_id) ON DELETE CASCADE,
  email        text NOT NULL,
  interest     text,                         -- 'gameday_live' | 'city:newark' | ...
  city_id      uuid REFERENCES cities (id) ON DELETE SET NULL,
  status       entity_status NOT NULL DEFAULT 'pending',
  coverage     coverage_state NOT NULL DEFAULT 'planned',
  source       text DEFAULT 'web',
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  UNIQUE (platform_id, email, interest)
);
CREATE INDEX IF NOT EXISTS idx_waitlist_platform ON waitlist (platform_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_waitlist_email    ON waitlist (platform_id, email) WHERE deleted_at IS NULL;
DROP TRIGGER IF EXISTS trg_waitlist_updated_at ON waitlist;
CREATE TRIGGER trg_waitlist_updated_at BEFORE UPDATE ON waitlist
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Coach queries — logged for honesty/audit. Coach never fabricates; when it
-- cannot answer from grounded sources, answered_from = 'none'.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coach_queries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id   text NOT NULL REFERENCES platforms (platform_id) ON DELETE CASCADE,
  session_id    text,
  question      text NOT NULL,
  answer        text,
  answered_from text NOT NULL DEFAULT 'none',  -- database | content | provider | none
  grounded      boolean NOT NULL DEFAULT false,
  status        entity_status NOT NULL DEFAULT 'published',
  coverage      coverage_state NOT NULL DEFAULT 'live',
  source        text DEFAULT 'coach_v1',
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_coach_platform ON coach_queries (platform_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_coach_grounded ON coach_queries (platform_id, grounded) WHERE deleted_at IS NULL;
DROP TRIGGER IF EXISTS trg_coach_updated_at ON coach_queries;
CREATE TRIGGER trg_coach_updated_at BEFORE UPDATE ON coach_queries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- platform_events — EMG Loop ingestion layer
-- ---------------------------------------------------------------------------
-- Every high-intent action across every InMyCity site is captured here so the
-- Loop operating layer can ingest activity, track entities (users, leads,
-- partners, waitlists, Coach queries, affiliate clicks, form/content events)
-- and route high-intent actions into Loop workflows. Loop automation itself is
-- NOT implemented in this migration; only the native event contract is.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id  text NOT NULL REFERENCES platforms (platform_id) ON DELETE CASCADE,
  event_type   loop_event_type NOT NULL,
  intent       loop_intent NOT NULL DEFAULT 'low',
  actor_id     text,                          -- pseudonymous; never a secret
  session_id   text,
  subject_type text,                          -- 'city' | 'sport' | 'partner' | ...
  subject_id   text,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  routed       boolean NOT NULL DEFAULT false, -- has Loop consumed/routed it?
  routed_at    timestamptz,
  source       text DEFAULT 'web',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_platform   ON platform_events (platform_id);
CREATE INDEX IF NOT EXISTS idx_events_type       ON platform_events (platform_id, event_type);
CREATE INDEX IF NOT EXISTS idx_events_intent     ON platform_events (platform_id, intent);
CREATE INDEX IF NOT EXISTS idx_events_unrouted   ON platform_events (platform_id, routed) WHERE routed = false;
CREATE INDEX IF NOT EXISTS idx_events_subject    ON platform_events (platform_id, subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_events_created     ON platform_events (created_at DESC);

-- ---------------------------------------------------------------------------
-- Schema migrations ledger (used by the migration runner)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations (version)
VALUES ('0001_foundation')
ON CONFLICT (version) DO NOTHING;

COMMIT;
