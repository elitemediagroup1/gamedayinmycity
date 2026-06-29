import { describe, it, expect } from 'vitest';
import { slugify, resolvePagination, buildPageMeta, ok, fail } from '../utils/index.js';
import {
  isPlatformId,
  isLoopEventType,
  DEFAULT_EVENT_INTENT,
  LOOP_EVENT_TYPES,
  PLATFORM_IDS,
} from '../types/index.js';

describe('slugify', () => {
  it('lowercases and dashes', () => {
    expect(slugify('New Jersey')).toBe('new-jersey');
  });
  it('strips diacritics and punctuation', () => {
    expect(slugify('Montréal!! Soccer')).toBe('montreal-soccer');
  });
  it('trims leading/trailing separators', () => {
    expect(slugify('  --Hello--  ')).toBe('hello');
  });
});

describe('pagination', () => {
  it('applies defaults', () => {
    const p = resolvePagination({});
    expect(p.page).toBe(1);
    expect(p.per_page).toBe(20);
    expect(p.offset).toBe(0);
  });
  it('clamps per_page to the max', () => {
    const p = resolvePagination({ per_page: 9999 });
    expect(p.per_page).toBe(100);
  });
  it('computes offset from page', () => {
    const p = resolvePagination({ page: 3, per_page: 10 });
    expect(p.offset).toBe(20);
  });
  it('builds page meta with ceiling total_pages', () => {
    const meta = buildPageMeta(resolvePagination({ page: 1, per_page: 10 }), 25);
    expect(meta.total).toBe(25);
    expect(meta.total_pages).toBe(3);
  });
});

describe('response builders', () => {
  it('ok wraps data', () => {
    const r = ok({ a: 1 });
    expect(r.ok).toBe(true);
    expect(r.data).toEqual({ a: 1 });
  });
  it('ok attaches meta when provided', () => {
    const meta = buildPageMeta(resolvePagination({}), 0);
    const r = ok([], meta);
    expect(r.meta).toBeDefined();
  });
  it('fail produces a typed error envelope', () => {
    const r = fail('not_found', 'missing');
    expect(r.ok).toBe(false);
    expect(r.error.code).toBe('not_found');
  });
});

describe('tenancy + loop guards', () => {
  it('recognises valid platform ids', () => {
    expect(isPlatformId('gameday')).toBe(true);
    expect(isPlatformId('nope')).toBe(false);
    expect(PLATFORM_IDS.length).toBe(5);
  });
  it('recognises valid loop event types', () => {
    expect(isLoopEventType('waitlist_submit')).toBe(true);
    expect(isLoopEventType('bogus')).toBe(false);
  });
  it('has a default intent for every event type', () => {
    for (const t of LOOP_EVENT_TYPES) {
      expect(DEFAULT_EVENT_INTENT[t]).toBeDefined();
    }
  });
  it('treats waitlist + partner leads as high intent', () => {
    expect(DEFAULT_EVENT_INTENT.waitlist_submit).toBe('high');
    expect(DEFAULT_EVENT_INTENT.partner_lead).toBe('high');
  });
});
