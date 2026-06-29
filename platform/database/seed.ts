/**
 * @platform/database/seed
 *
 * Idempotent seed script. Safe to run repeatedly (uses upserts).
 *
 * Seeds:
 *   1. The platforms tenant registry (all known InMyCity properties).
 *   2. A minimal honest GameDay dataset (a few sports + one pilot state)
 *      so the API and health checks have real rows to return.
 *
 * Run: tsx database/seed.ts
 */

import { query, closePool } from './client.js';
import { slugify } from '../utils/index.js';

interface PlatformSeed {
  platform_id: string;
  name: string;
  domain: string | null;
  status: 'draft' | 'published';
  coverage: 'live' | 'rolling_out' | 'planned';
}

const PLATFORMS: PlatformSeed[] = [
  { platform_id: 'gameday',  name: 'GameDayInMyCity',  domain: 'gamedayinmycity.com', status: 'published', coverage: 'rolling_out' },
  { platform_id: 'care',     name: 'CareInMyCity',     domain: null, status: 'draft', coverage: 'planned' },
  { platform_id: 'pets',     name: 'PetsInMyCity',     domain: null, status: 'draft', coverage: 'planned' },
  { platform_id: 'services', name: 'ServicesInMyCity', domain: null, status: 'draft', coverage: 'planned' },
  { platform_id: 'schools',  name: 'SchoolsInMyCity',  domain: null, status: 'draft', coverage: 'planned' },
];

// Honest MVP seed data for GameDay. Coverage is 'rolling_out' — not fake-live.
const GAMEDAY_SPORTS: Array<{ name: string; category: string }> = [
  { name: 'Basketball', category: 'team' },
  { name: 'Soccer', category: 'team' },
  { name: 'Baseball', category: 'team' },
  { name: 'Tennis', category: 'individual' },
  { name: 'Esports', category: 'esports' },
];

async function seedPlatforms(): Promise<void> {
  for (const p of PLATFORMS) {
    await query(
      `INSERT INTO platforms (platform_id, name, domain, status, coverage, source)
       VALUES ($1, $2, $3, $4, $5, 'seed')
       ON CONFLICT (platform_id) DO UPDATE
         SET name = EXCLUDED.name, domain = EXCLUDED.domain`,
      [p.platform_id, p.name, p.domain, p.status, p.coverage],
    );
  }
  process.stdout.write('[seed] platforms: ' + PLATFORMS.length + ' upserted\n');
}

async function seedGameday(): Promise<void> {
  // Pilot state
  await query(
    `INSERT INTO states (platform_id, slug, name, code, status, coverage, source)
     VALUES ('gameday', 'new-jersey', 'New Jersey', 'NJ', 'published', 'rolling_out', 'seed')
     ON CONFLICT (platform_id, slug) DO NOTHING`,
  );

  for (const s of GAMEDAY_SPORTS) {
    await query(
      `INSERT INTO sports (platform_id, slug, name, category, status, coverage, source)
       VALUES ('gameday', $1, $2, $3, 'published', 'rolling_out', 'seed')
       ON CONFLICT (platform_id, slug) DO UPDATE
         SET name = EXCLUDED.name, category = EXCLUDED.category`,
      [slugify(s.name), s.name, s.category],
    );
  }
  process.stdout.write('[seed] gameday: ' + GAMEDAY_SPORTS.length + ' sports + 1 state\n');
}

async function main(): Promise<void> {
  await seedPlatforms();
  await seedGameday();
  process.stdout.write('[seed] complete\n');
  await closePool();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[seed] failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
  void closePool();
});
