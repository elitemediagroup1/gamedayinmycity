/**
 * @platform/config
 *
 * Typed, validated environment configuration for the GameDay Platform.
 *
 * Secrets are NEVER hard-coded. They are read from process.env and validated
 * with zod at process start. Missing required secrets cause a fast, explicit
 * failure (fail-closed) rather than silent misbehaviour in production.
 *
 * See platform/.env.example for the full list of variables.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const booleanFromString = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : v.toLowerCase() === 'true'));

const EnvSchema = z.object({
  // Runtime
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Supabase / Postgres
  // DATABASE_URL is the pooled Postgres connection string used by the API.
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgres')),
  // DIRECT_URL is the non-pooled connection used for migrations.
  DIRECT_URL: z.string().url().or(z.string().startsWith('postgres')).optional(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  // Service-role key: server-only. Never exposed to any frontend.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Redis cache (optional — platform degrades gracefully without it)
  REDIS_URL: z.string().optional(),
  CACHE_ENABLED: booleanFromString.default(true),
  CACHE_DEFAULT_TTL_SECONDS: z.coerce.number().int().nonnegative().default(300),

  // Providers
  SPORTSDATAIO_API_KEY: z.string().optional(),
  SPORTSDATAIO_BASE_URL: z.string().url().default('https://api.sportsdata.io/v3'),

  // EMG Loop integration (operating layer)
  LOOP_ENABLED: booleanFromString.default(true),
  LOOP_INGEST_URL: z.string().url().optional(),
  LOOP_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

// ---------------------------------------------------------------------------
// Loader (singleton)
// ---------------------------------------------------------------------------

let cached: Env | null = null;

/**
 * Parse and validate process.env. Throws a descriptive error listing every
 * invalid/missing variable. Cached after first successful load.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => '  - ' + i.path.join('.') + ': ' + i.message)
      .join('\n');
    throw new Error('Invalid environment configuration:\n' + issues);
  }
  cached = parsed.data;
  return cached;
}

/** Reset the cached env. Test-only helper. */
export function resetEnvCache(): void {
  cached = null;
}

/**
 * Convenience accessor. Lazily loads on first use so importing this module
 * never crashes at import time (important for tooling and tests).
 */
export function env(): Env {
  return loadEnv();
}

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

export function isProduction(): boolean {
  return env().NODE_ENV === 'production';
}

export function isTest(): boolean {
  return env().NODE_ENV === 'test';
}

export function cacheEnabled(): boolean {
  const e = env();
  return e.CACHE_ENABLED && Boolean(e.REDIS_URL);
}

export function loopEnabled(): boolean {
  const e = env();
  return e.LOOP_ENABLED;
}

export function sportsDataIoConfigured(): boolean {
  return Boolean(env().SPORTSDATAIO_API_KEY);
}
