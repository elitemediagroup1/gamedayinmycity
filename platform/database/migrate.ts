/**
 * @platform/database/migrate
 *
 * Minimal, dependency-light SQL migration runner.
 *
 * Migrations live in ./migrations as NNNN_name.sql files and are applied in
 * filename order. Applied versions are tracked in the schema_migrations table
 * (created by 0001_foundation). Each migration file is expected to be
 * idempotent (CREATE ... IF NOT EXISTS, guarded enum creation, etc.) and to
 * manage its own BEGIN/COMMIT.
 *
 * Usage:
 *   tsx database/migrate.ts up       apply all pending migrations
 *   tsx database/migrate.ts status   list applied vs pending
 *   tsx database/migrate.ts down     remove the schema_migrations record for
 *                                    the latest version (does NOT auto-drop
 *                                    tables; destructive rollback is manual by
 *                                    design — see DATABASE_README).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pgPool, query, closePool } from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

interface Migration {
  version: string;
  file: string;
  sql: string;
}

function loadMigrations(): Migration[] {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  return files.map((file) => ({
    version: file.replace(/\.sql$/, ''),
    file,
    sql: readFileSync(join(MIGRATIONS_DIR, file), 'utf8'),
  }));
}

async function ensureLedger(): Promise<void> {
  await query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
}

async function appliedVersions(): Promise<Set<string>> {
  const res = await query<{ version: string }>('SELECT version FROM schema_migrations');
  return new Set(res.rows.map((r) => r.version));
}

async function up(): Promise<void> {
  await ensureLedger();
  const applied = await appliedVersions();
  const migrations = loadMigrations();
  let count = 0;
  for (const m of migrations) {
    if (applied.has(m.version)) continue;
    process.stdout.write('[migrate] applying ' + m.version + ' ... ');
    await query(m.sql);
    await query('INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING', [m.version]);
    process.stdout.write('done\n');
    count++;
  }
  process.stdout.write(count === 0 ? '[migrate] already up to date\n' : '[migrate] applied ' + count + ' migration(s)\n');
}

async function status(): Promise<void> {
  await ensureLedger();
  const applied = await appliedVersions();
  const migrations = loadMigrations();
  for (const m of migrations) {
    process.stdout.write((applied.has(m.version) ? '[x] ' : '[ ] ') + m.version + '\n');
  }
}

async function down(): Promise<void> {
  await ensureLedger();
  const applied = [...(await appliedVersions())].sort();
  const latest = applied[applied.length - 1];
  if (!latest) {
    process.stdout.write('[migrate] nothing to roll back\n');
    return;
  }
  await query('DELETE FROM schema_migrations WHERE version = $1', [latest]);
  process.stdout.write('[migrate] removed ledger entry for ' + latest + ' (tables not dropped — see DATABASE_README)\n');
}

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? 'status';
  // Touch the pool so a bad connection string fails fast and clearly.
  pgPool();
  switch (cmd) {
    case 'up':
      await up();
      break;
    case 'down':
      await down();
      break;
    case 'status':
      await status();
      break;
    default:
      process.stderr.write('Unknown command: ' + cmd + '. Use up | down | status.\n');
      process.exitCode = 1;
  }
  await closePool();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[migrate] failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
  void closePool();
});
