import { describe, it, expect } from 'vitest';
import { buildLoopEvent } from '../shared/index.js';

describe('buildLoopEvent', () => {
  it('fills defaults: intent from event type, null subjects, web source', () => {
    const ev = buildLoopEvent({ platform_id: 'gameday', event_type: 'content_view' });
    expect(ev.platform_id).toBe('gameday');
    expect(ev.event_type).toBe('content_view');
    expect(ev.intent).toBe('low');
    expect(ev.actor_id).toBeNull();
    expect(ev.subject_type).toBeNull();
    expect(ev.payload).toEqual({});
    expect(ev.source).toBe('web');
  });

  it('uses high default intent for waitlist_submit', () => {
    const ev = buildLoopEvent({ platform_id: 'gameday', event_type: 'waitlist_submit' });
    expect(ev.intent).toBe('high');
  });

  it('respects an explicit intent override', () => {
    const ev = buildLoopEvent({ platform_id: 'care', event_type: 'search_query', intent: 'high' });
    expect(ev.intent).toBe('high');
  });

  it('preserves subject + payload', () => {
    const ev = buildLoopEvent({
      platform_id: 'pets',
      event_type: 'city_interest',
      subject_type: 'city',
      subject_id: 'newark',
      payload: { ref: 'hero' },
    });
    expect(ev.subject_id).toBe('newark');
    expect(ev.payload).toEqual({ ref: 'hero' });
  });

  it('rejects an invalid platform_id', () => {
    // @ts-expect-error intentionally invalid for the guard test
    expect(() => buildLoopEvent({ platform_id: 'nope', event_type: 'content_view' })).toThrow();
  });

  it('rejects an invalid event_type', () => {
    // @ts-expect-error intentionally invalid for the guard test
    expect(() => buildLoopEvent({ platform_id: 'gameday', event_type: 'boom' })).toThrow();
  });
});
