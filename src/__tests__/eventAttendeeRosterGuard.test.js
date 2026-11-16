/**
 * The event attendee roster must show real attendee identities, never a
 * fabricated stand-in.
 *
 * `events/{id}.attendees` stores only `{ status, ticketTier, registeredAt,
 * checkedInAt }` per uid — there is no display name on the event document (the
 * registration callables never write one). `EventDetailScreen` nevertheless
 * rendered `data.displayName || 'User'`, so **every** attendee showed the
 * placeholder name "User" and a generic gradient blob, and the real identity
 * was lost.
 *
 * The fix resolves the roster server-side (`getEventAttendees`), which reads
 * the real `users/{uid}` profiles (bounded `documentId() in` batches) and
 * strips placeholder names/handles. These guards fail if the screen reverts to
 * the fabricated placeholder or the callable path is dropped.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('event attendee roster is server-resolved, not fabricated', () => {
  test('the screen renders the resolved roster, never a placeholder name', () => {
    const src = read('src/screens/Event/EventDetailScreen.jsx');
    // The old fabricated fallback is gone.
    expect(src).not.toMatch(/data\.displayName \|\| 'User'/);
    expect(src).not.toMatch(/'User'/);
    // It consumes the roster from the service and resolves a real avatar.
    expect(src).toMatch(/eventService\.getEventAttendees\(/);
    expect(src).toMatch(/attendeeRoster/);
    expect(src).toMatch(/getSafeAvatarUrl\(/);
  });

  test('eventService exposes getEventAttendees via the callable', () => {
    const src = read('src/services/eventService.js');
    expect(src).toMatch(/async getEventAttendees\(/);
    expect(src).toMatch(/FUNCTIONS\.GET_EVENT_ATTENDEES/);
  });

  test('the FUNCTIONS map and the server export agree', () => {
    const callables = read('src/services/callableService.js');
    expect(callables).toMatch(/GET_EVENT_ATTENDEES:\s*'getEventAttendees'/);
    const server = read('functions/events.js');
    expect(server).toMatch(/exports\.getEventAttendees = functions\.https\.onCall\(/);
  });

  test('the callable resolves real profiles and refuses placeholders', () => {
    const server = read('functions/events.js');
    const block = server.slice(
      server.indexOf('exports.getEventAttendees'),
      server.indexOf('exports.submitEventFeedback'),
    );
    // Batched `users` read by documentId — never one profile fetch per attendee.
    expect(block).toMatch(/collection\('users'\)\.where\(admin\.firestore\.FieldPath\.documentId\(\), 'in', chunk\)/);
    // Placeholder names/handles are dropped rather than surfaced.
    expect(block).toMatch(/isPlaceholder/);
    expect(block).toMatch(/isPlaceholder\(displayName\) \? null : displayName/);
    expect(block).toMatch(/isPlaceholder\(username\) \? null : username/);
    // A non-attendee (not organizer, not registered) gets no roster.
    expect(block).toMatch(/return \{ attendees: \[\] \};/);
  });
});
