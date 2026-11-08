/**
 * Route-param wiring guard.
 *
 * A `path="/x/:id"` route is a contract: the component it renders must read the
 * param. Two screens shipped without honouring it, so the deep link "worked"
 * but did nothing:
 *
 *  - `/event/:eventId/edit` rendered `CreateEventScreen`, which ignored
 *    `eventId` and always created a NEW event — "Edit event" duplicated it.
 *  - `/edit/:postId` rendered `CreatePost`, whose `EditPostLoader` read only
 *    `?edit=` — "Edit post" opened an empty composer and published a duplicate.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('event edit route edits the event', () => {
  const screen = read('src/screens/Event/CreateEventScreen.jsx');

  test('CreateEventScreen reads the :eventId route param', () => {
    expect(screen).toMatch(/useParams\(\)/);
    expect(screen).toMatch(/\{\s*eventId\s*\}\s*=\s*useParams\(\)/);
  });

  test('edit mode loads the event and calls updateEvent, not createEvent', () => {
    expect(screen).toMatch(/eventService\.getEvent\(eventId\)/);
    expect(screen).toMatch(/eventService\.updateEvent\(eventId,/);
    expect(screen).toMatch(/if \(isEdit\)/);
  });
});

describe('post edit route updates the post', () => {
  const screen = read('src/screens/CreatePost.jsx');

  test('EditPostLoader reads the :postId route param', () => {
    expect(screen).toMatch(/useParams\(\)/);
    expect(screen).toMatch(/postId:\s*routePostId/);
    expect(screen).toMatch(/searchParams\.get\("edit"\)\s*\|\|\s*routePostId/);
  });

  test('publishing in edit mode calls updatePost and never re-creates', () => {
    expect(screen).toMatch(/firestoreService\.updatePost\(editPostId,/);
    expect(screen).toMatch(/if \(editPostId\) \{/);
    expect(screen).toMatch(/navigate\(`\/post\/\$\{editPostId\}`\)/);
  });
});
