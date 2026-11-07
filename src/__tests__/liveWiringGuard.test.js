/**
 * Live screen wiring guard.
 *
 * The watch view polled `getLiveStream` every 2.5s into `watching`, but the
 * viewer-count badges rendered `watching.viewerCount ?? 0` — a value that was
 * only whatever the discover list happened to carry at click time. The live
 * count was polled and then thrown away, so the header showed a frozen number
 * while the stream was actually being watched.
 *
 * The count now lives in a dedicated `watchViewers` state, seeded on watch
 * start and refreshed by the same poll that keeps `watching` current. This
 * guard pins that: the badge must not read the stale stream object, and every
 * place that refreshes the stream must refresh the count too.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = fs.readFileSync(path.join(root, 'src/screens/LiveScreen.jsx'), 'utf8');

describe('LiveScreen viewer count is the polled value, not the stale stream object', () => {
  test('the watching header never renders watching.viewerCount', () => {
    expect(src).not.toMatch(/watching\.viewerCount/);
  });

  test('a dedicated watchViewers state drives the badge', () => {
    expect(src).toMatch(/const \[watchViewers, setWatchViewers\] = useState\(0\)/);
    expect(src).toMatch(/\{watchViewers\}/);
  });

  test('the count is seeded when a stream is opened', () => {
    const start = src.indexOf('const handleWatch');
    const body = src.slice(start, src.indexOf('};', start));
    expect(body).toMatch(/setWatchViewers\(stream\?\.viewerCount \?\? stream\?\.stats\?\.totalViewers \?\? 0\)/);
  });

  test('every stream refresh also refreshes the count', () => {
    const start = src.indexOf('watchPollRef.current = setInterval');
    const body = src.slice(start, src.indexOf('}, POLL_MS)', start));
    expect(body).toMatch(/getLiveStream/);
    expect(body).toMatch(/setWatchViewers\(fresh\.viewerCount \?\? fresh\.stats\?\.totalViewers \?\? 0\)/);
  });

  test('the discover list only shows genuinely live, non-deleted streams', () => {
    const service = fs.readFileSync(path.join(root, 'src/services/liveService.js'), 'utf8');
    const start = service.indexOf('async getActiveLiveStreams');
    const body = service.slice(start, service.indexOf('\n  }', start));
    expect(body).toMatch(/where\('status', '==', 'live'\)/);
    expect(body).toMatch(/where\('isDeleted', '==', false\)/);
  });
});
