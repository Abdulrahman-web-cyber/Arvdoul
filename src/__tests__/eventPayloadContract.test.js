/**
 * Event-payload contract guard (#17).
 *
 * `deadEventGuard` proves every dispatched `arvdoul:*` event has *a* listener.
 * It does not prove the listener reads the payload the dispatcher builds — an
 * event can be "wired" (a listener exists) while the payload shape silently
 * drifted, so the consumer destructures `undefined`. That is the same
 * "looks-wired, is-not" class as `deadWiringGuard`.
 *
 * Each row pins the producer's payload shape and the consumer's read of it. A
 * change to either side that breaks the pairing fails here.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/**
 * @type {Array<{
 *   event: string,
 *   producer: string,        // file that dispatches
 *   producerPattern: RegExp, // dispatch site + payload construction
 *   consumer: string,        // file that listens
 *   consumerPattern: RegExp, // listener that reads the payload
 * }>}
 */
const CONTRACTS = [
  {
    event: 'arvdoul:navigate',
    producer: 'src/services/notificationsService.js',
    producerPattern: /CustomEvent\(\s*['"]arvdoul:navigate['"]\s*,\s*\{\s*detail:\s*\{\s*url:/,
    consumer: 'src/layouts/MainLayout.jsx',
    consumerPattern: /event\?\.detail\?\.url/,
  },
  {
    event: 'arvdoul:post_id_synced',
    producer: 'src/screens/CreatePost.jsx',
    producerPattern: /CustomEvent\(\s*['"]arvdoul:post_id_synced['"]\s*,\s*\{\s*detail:\s*\{\s*oldId:\s*instantPostId,\s*newId:\s*result\.postId\s*\}/,
    consumer: 'src/screens/HomeScreen.jsx',
    consumerPattern: /const\s*\{\s*oldId,\s*newId\s*\}\s*=\s*e\.detail/,
  },
  {
    event: 'arvdoul:search_query',
    producer: 'src/components/Shared/TopAppBar.jsx',
    producerPattern: /CustomEvent\(\s*["']arvdoul:search_query["']\s*,\s*\{\s*detail:\s*(val|"")\s*\}/,
    consumer: 'src/screens/SearchScreen.jsx',
    consumerPattern: /e\.detail\s*\?\?\s*''/,
  },
  {
    event: 'arvdoul:set_search_query',
    producer: 'src/screens/SearchScreen.jsx',
    producerPattern: /CustomEvent\(\s*['"]arvdoul:set_search_query['"]\s*,\s*\{\s*detail:\s*(searchQuery|text|categoryId|val|'')\s*\}/,
    consumer: 'src/components/Shared/TopAppBar.jsx',
    consumerPattern: /typeof\s+e\.detail\s*===\s*["']string["']/,
  },
  {
    event: 'arvdoul:new_post_published',
    producer: 'src/screens/CreatePost.jsx',
    producerPattern: /CustomEvent\(\s*['"]arvdoul:new_post_published['"]\s*,\s*\{\s*detail:\s*instantPublishedPost\s*\}/,
    consumer: 'src/screens/HomeScreen.jsx',
    consumerPattern: /const\s+newPost\s*=\s*e\.detail/,
  },
];

describe('event-payload contract', () => {
  test.each(CONTRACTS)(
    '$event: producer builds the payload the consumer reads',
    ({ producer, producerPattern, consumer, consumerPattern }) => {
      const producerSrc = read(producer);
      const consumerSrc = read(consumer);
      expect(producerSrc).toMatch(producerPattern);
      expect(consumerSrc).toMatch(consumerPattern);
    }
  );

  test('every CustomEvent payload in the tree is a literal object or a value (not a bare dispatch)', () => {
    // Catches a dispatch that forgot `detail` entirely — the listener then reads
    // `undefined`. Only flagged for our app events.
    const files = [
      'src/services/notificationsService.js',
      'src/services/userService.js',
      'src/services/messagesService.js',
      'src/screens/CreatePost.jsx',
      'src/screens/SearchScreen.jsx',
      'src/components/Shared/TopAppBar.jsx',
      'src/components/profile/ProfileOptionsMenu.jsx',
    ];
    const offenders = [];
    for (const file of files) {
      const src = read(file);
      const re = /CustomEvent\(\s*['"]arvdoul:[\w:.-]+['"]\s*(,\s*\{[^}]*\})?\s*\)/g;
      for (const m of src.matchAll(re)) {
        const name = m[0].match(/['"](arvdoul:[\w:.-]+)['"]/)?.[1];
        // Events that intentionally carry no payload are allowed only if listed.
        const NO_PAYLOAD_OK = new Set([
          'arvdoul:friend-request-changed',
          'arvdoul:messages-read',
          'arvdoul:notification-read',
          'arvdoul:open_location_setup',
          'arvdoul:open_perspective_modal',
          'arvdoul:open_profile_options',
          'arvdoul:open_qr_code',
          'arvdoul:share_profile',
          'arvdoul:toggle_search_filters',
        ]);
        if (NO_PAYLOAD_OK.has(name)) continue;
        if (!/detail\s*:/.test(m[0])) offenders.push(`${file}: ${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
