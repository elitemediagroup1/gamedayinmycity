/**
 * @platform/shared
 *
 * Barrel of cross-cutting building blocks. Higher layers (api, services,
 * providers, ai) import from here so the foundation surface is stable and
 * the dependency direction stays one-way (shared <- everything else).
 */

export * from '../types/index.js';
export * from '../utils/index.js';
export {
  env,
  loadEnv,
  resetEnvCache,
  isProduction,
  isTest,
  cacheEnabled,
  loopEnabled,
  sportsDataIoConfigured,
} from '../config/index.js';
export type { Env } from '../config/index.js';

/**
 * Build a platform_events row payload. The single, canonical helper every
 * layer uses to emit Loop events, so event shape stays consistent. Persisting
 * the row is the caller's responsibility (service/API layer in PR-B/PR-C).
 */
import type { LoopEventType, LoopIntent, PlatformId } from '../types/index.js';
import { DEFAULT_EVENT_INTENT, isLoopEventType, isPlatformId } from '../types/index.js';

export interface LoopEventInput {
  platform_id: PlatformId;
  event_type: LoopEventType;
  intent?: LoopIntent;
  actor_id?: string | null;
  session_id?: string | null;
  subject_type?: string | null;
  subject_id?: string | null;
  payload?: Record<string, unknown>;
  source?: string;
}

export interface LoopEventRow {
  platform_id: PlatformId;
  event_type: LoopEventType;
  intent: LoopIntent;
  actor_id: string | null;
  session_id: string | null;
  subject_type: string | null;
  subject_id: string | null;
  payload: Record<string, unknown>;
  source: string;
}

export function buildLoopEvent(input: LoopEventInput): LoopEventRow {
  if (!isPlatformId(input.platform_id)) {
    throw new Error('buildLoopEvent: invalid platform_id ' + String(input.platform_id));
  }
  if (!isLoopEventType(input.event_type)) {
    throw new Error('buildLoopEvent: invalid event_type ' + String(input.event_type));
  }
  return {
    platform_id: input.platform_id,
    event_type: input.event_type,
    intent: input.intent ?? DEFAULT_EVENT_INTENT[input.event_type],
    actor_id: input.actor_id ?? null,
    session_id: input.session_id ?? null,
    subject_type: input.subject_type ?? null,
    subject_id: input.subject_id ?? null,
    payload: input.payload ?? {},
    source: input.source ?? 'web',
  };
}
