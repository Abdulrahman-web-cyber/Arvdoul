/**
 * src/__tests__/analyticsInteractionSink.test.js
 *
 * Exercises the real interaction-event sink (`analyticsService.trackAnalyticsEvent`
 * / `trackAnalyticsBatch`). The PostCard sub-cards emit `onAnalytics(event, data)`
 * for their own interaction events; the sink folds those into the shared
 * `metricsService` counters. These tests assert the real code path, not a mock.
 *
 * @jest-environment node
 */

import { getAnalyticsService, trackAnalyticsEvent } from '../services/analyticsService.js';
import { metricsService } from '../services/metricsService.js';

// The default export is a Proxy that forwards method calls to the singleton
// instance; internal queue state must be read from the instance itself.
const sink = () => getAnalyticsService();

describe('analytics interaction sink', () => {
  beforeEach(() => {
    metricsService.counters.clear();
    sink()._interactionQueue = [];
    sink()._interactionTimer = null;
  });

  test('records an event into the metrics registry after flush', () => {
    expect(sink().trackAnalyticsEvent('link_click', { postId: 'p1' })).toBe(true);
    sink()._flushInteractionEvents();
    expect(sink().getInteractionCount('link_click')).toBe(1);
    expect(metricsService.counters.get('post_event_link_click')).toBe(1);
  });

  test('normalizes event names and rejects unusable ones', () => {
    expect(sink().trackAnalyticsEvent('Link Click!!', { postId: 'p1' })).toBe(true);
    sink()._flushInteractionEvents();
    expect(sink().getInteractionCount('link_click')).toBe(1);
    expect(sink().trackAnalyticsEvent('', {})).toBe(false);
    expect(sink().trackAnalyticsEvent(42, {})).toBe(false);
  });

  test('accepts a sub-card batch and counts each event', () => {
    const accepted = sink().trackAnalyticsBatch([
      { event: 'image_load', data: { postId: 'p1' } },
      { event: 'image_error', data: { postId: 'p1', error: 'x' } },
      { event: 'poll_vote_success', data: { postId: 'p2' } },
    ]);
    expect(accepted).toBe(3);
    sink()._flushInteractionEvents();
    expect(sink().getInteractionCount('image_load')).toBe(1);
    expect(sink().getInteractionCount('image_error')).toBe(1);
    expect(sink().getInteractionCount('poll_vote_success')).toBe(1);
  });

  test('never retains user content — only a plausible postId and an error flag', () => {
    sink().trackAnalyticsEvent('link_click', {
      postId: 'p1',
      url: 'https://secret.example/private?token=abc',
      note: 'user text',
      error: 'boom',
    });
    const queued = sink()._interactionQueue[0];
    expect(queued.data).toEqual({ postId: 'p1', error: true });
  });

  test('the stable module-level dispatcher routes batches and single events', () => {
    trackAnalyticsEvent('batch', { events: [{ event: 'text_copy', data: { postId: 'p1' } }] });
    trackAnalyticsEvent('link_save', { postId: 'p1' });
    sink()._flushInteractionEvents();
    expect(sink().getInteractionCount('text_copy')).toBe(1);
    expect(sink().getInteractionCount('link_save')).toBe(1);
  });
});
