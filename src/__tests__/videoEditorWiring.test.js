/**
 * Video Studio (VideoEditor) integration guards.
 *
 * The editor used to render a fully formed UI over a data model that could not
 * exist: `INITIAL_TRACKS` had no `clips` array, so `totalDuration` threw
 * `Cannot read properties of undefined (reading 'map')` on first render and the
 * whole route died inside its error boundary. Track ids in the screen
 * (`track-video`) also did not match the ids in the initial state
 * (`track_video_1`), so every add-media handler silently no-oped, and the
 * LayersPanel / MultiTrackTimeline / PreviewCanvas / TimelineToolbar / TrimSubPanel
 * children were fed prop contracts they do not declare (dead controls).
 *
 * These assertions pin the wiring so a regression is caught without a browser.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

describe('Video Studio data model', () => {
  const constants = read('src/screens/VideoEditor/constants.js');
  const screen = read('src/screens/VideoEditor/VideoEditorScreen.jsx');

  test('every initial track carries a clips array', () => {
    // The literal block of INITIAL_TRACKS must define clips on each track.
    const block = constants.slice(constants.indexOf('export const INITIAL_TRACKS'), constants.indexOf('export const STOCK_VIDEOS'));
    const trackLines = block.split('\n').filter((l) => l.trim().startsWith('{ id:'));
    expect(trackLines.length).toBeGreaterThan(0);
    for (const line of trackLines) {
      expect(line).toContain('clips: []');
    }
  });

  test('the screen tolerates tracks without a clips array', () => {
    expect(screen).toContain('t.clips || []');
    // The unguarded form is what crashed the route.
    expect(screen).not.toMatch(/flatMap\(\(t\) => t\.clips\.map/);
  });

  test('track ids used by the screen exist in the initial state', () => {
    const ids = ['track-video', 'track-text', 'track-stickers', 'track-audio'];
    for (const id of ids) {
      expect(constants).toMatch(new RegExp(`id: '${id}'`));
    }
    // The old underscore ids are gone (they never matched the handlers).
    expect(constants).not.toContain("id: 'track_video_1'");
  });
});

describe('Video Studio child contracts', () => {
  const screen = read('src/screens/VideoEditor/VideoEditorScreen.jsx');

  test('the flattened clip map is passed to MultiTrackTimeline', () => {
    expect(screen).toMatch(/const clips = useMemo/);
    expect(screen).toMatch(/<MultiTrackTimeline[\s\S]{0,400}clips=\{clips\}/);
    expect(screen).toMatch(/<MultiTrackTimeline[\s\S]{0,400}onAddTrack=\{handleAddTrack\}/);
  });

  test('LayersPanel receives layers/selectedLayerId, not tracks/selectedTrackId', () => {
    const layersBlock = screen.slice(screen.indexOf('<LayersPanel'), screen.indexOf('<LayersPanel') + 700);
    expect(layersBlock).toContain('layers={layers}');
    expect(layersBlock).toContain('selectedLayerId={selectedClipId}');
    expect(layersBlock).not.toContain('tracks={tracks}');
  });

  test('TimelineToolbar receives hasSelection/isMagnetOn, not currentTime/isMagnetSnap', () => {
    const block = screen.slice(screen.indexOf('<TimelineToolbar'), screen.indexOf('<TimelineToolbar') + 600);
    expect(block).toContain('hasSelection=');
    expect(block).toContain('isMagnetOn=');
    expect(block).not.toContain('isMagnetSnap=');
    expect(block).not.toContain('currentTime=');
  });

  test('PreviewCanvas is fed clips and playback controls it declares', () => {
    const block = screen.slice(screen.indexOf('<PreviewCanvas'), screen.indexOf('<PreviewCanvas') + 900);
    expect(block).toContain('clips={clips}');
    expect(block).toContain('isLooping=');
    expect(block).toContain('onToggleMute=');
    expect(block).not.toContain('currentClip=');
    expect(block).not.toContain('playbackSpeed=');
  });

  test('clip updates use the (trackId, clipId, updates) contract with a legacy fallback', () => {
    expect(screen).toMatch(/handleUpdateClip = \(trackId, clipId, updates\)/);
    expect(screen).toMatch(/if \(updates === undefined\)/);
  });
});

describe('Video Studio dead props removed', () => {
  const screen = read('src/screens/VideoEditor/VideoEditorScreen.jsx');

  test('the layers panel has a reachable toggle', () => {
    expect(screen).toMatch(/setIsLayersPanelOpen/);
    // The old canvas prop that was supposed to open it was ignored.
    expect(screen).not.toContain('onToggleLayersPanel');
  });

  test('project save/new/load are wired to the header', () => {
    expect(screen).toMatch(/onSaveProject=\{handleSaveProject\}/);
    expect(screen).toMatch(/onNewProject=\{handleNewProject\}/);
    expect(screen).toMatch(/savedProjects=\{savedProjects\}/);
    expect(screen).toMatch(/onLoadProject=\{handleLoadProject\}/);
  });
});
