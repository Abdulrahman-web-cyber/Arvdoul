/**
 * Reducer-dispatch guard.
 *
 * The CreatePost wizard keeps its draft in a `useReducer`. The type sub-editors
 * (CreateEvent, CreateLink, CreateAudio, …) dispatch into that reducer, but the
 * reducer's `default: break;` swallows an unknown action type silently. That
 * shipped a whole class of "looks wired, is not" bugs:
 *
 *  - CreateEvent dispatched SET_EVENT_DESCRIPTION / SET_EVENT_COVER /
 *    SET_EVENT_RSVP / SET_EVENT_CAPACITY / SET_EVENT_LOCATION_DATA /
 *    SET_EVENT_TIMEZONE, none of which existed — so the event description,
 *    cover, RSVP toggle and capacity were never published.
 *  - CreateLink dispatched SET_LINK_METADATA / SET_LINK_THUMBNAIL — so the
 *    scraped OpenGraph preview was never persisted.
 *  - CreateAudio dispatched SET_TYPE_DATA — so the track title/artist/genre
 *    never reached state.
 *
 * This guard fails if any `dispatch({ type: "X" })` in the CreatePost tree has
 * no matching `case "X"` (or `action.type === "X"`) in the orchestrator reducer.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ORCHESTRATOR = path.join(root, 'src/screens/CreatePost.jsx');
const TREE = path.join(root, 'src/screens/CreatePost');

function collect(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(full));
    else if (/\.(jsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('reducer-dispatch guard: every dispatched action is handled', () => {
  test('no CreatePost tree dispatch hits the reducer default branch', () => {
    const reducerSource = fs.readFileSync(ORCHESTRATOR, 'utf8');

    // Action types the reducer actually handles: switch cases plus the
    // UNDO/REDO early returns (`if (action.type === "UNDO")`).
    const handled = new Set([
      ...[...reducerSource.matchAll(/case\s+"([A-Z0-9_]+)"/g)].map((m) => m[1]),
      ...[...reducerSource.matchAll(/action\.type\s*===\s*"([A-Z0-9_]+)"/g)].map((m) => m[1]),
    ]);

    const files = [ORCHESTRATOR, ...collect(TREE)];
    const violations = [];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(/dispatch\(\s*\{\s*type:\s*"([A-Z0-9_]+)"/g)) {
        if (!handled.has(match[1])) {
          violations.push(`${path.relative(root, file)}: dispatches "${match[1]}" with no reducer case`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test('the guard would catch a synthetic dead dispatch', () => {
    const handled = new Set(['SET_CONTENT']);
    const source = 'dispatch({ type: "SET_NOT_A_REAL_ACTION", payload: 1 });';
    const found = [...source.matchAll(/dispatch\(\s*\{\s*type:\s*"([A-Z0-9_]+)"/g)]
      .map((m) => m[1])
      .filter((t) => !handled.has(t));
    expect(found).toEqual(['SET_NOT_A_REAL_ACTION']);
  });
});
