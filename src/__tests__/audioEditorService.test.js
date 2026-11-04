/**
 * src/__tests__/audioEditorService.test.js
 *
 * audioEditorService is the real Web Audio project model behind the Audio
 * Studio (AudioEditorScreen imports it). This covers project lifecycle, the
 * effect/marker/trim model, undo/redo and persistence against a fake
 * localStorage. Only Firebase Storage is stubbed (it is not the unit under
 * test); every state transition runs the real code.
 */

import { jest } from '@jest/globals';

jest.unstable_mockModule('../firebase/firebase.js', () => ({
  getStorageInstance: () => ({}),
  getFirestoreInstance: async () => ({}),
  db: {},
  auth: { currentUser: null },
  storage: {},
}));

jest.unstable_mockModule('firebase/storage', () => ({
  ref: (_s, path) => ({ path }),
  uploadBytes: async () => ({}),
  getDownloadURL: async () => 'https://cdn.example/audio.mp3',
}));

const { getAudioEditorService, AUDIO_EDITOR_CONFIG, AudioEditorError } = await import(
  '../services/audioEditorService.js'
);

let svc;

beforeEach(() => {
  localStorage.clear();
  svc = getAudioEditorService();
  svc.currentProject = null;
  svc.audioBuffer = null;
  svc.audioContext = null;
});

describe('project lifecycle', () => {
  test('createProject seeds a real, empty project', () => {
    const p = svc.createProject({ name: 'Track' });
    expect(p.name).toBe('Track');
    expect(p.effects).toEqual([]);
    expect(p.markers).toEqual([]);
    expect(p.duration).toBe(0);
    expect(p.volume).toBe(AUDIO_EDITOR_CONFIG.VOLUME.DEFAULT);
    expect(svc.getCurrentProject()).toBe(p);
  });

  test('loadProject rejects data without an id', () => {
    expect(() => svc.loadProject({})).toThrow(AudioEditorError);
  });

  test('saveProject round-trips through localStorage', () => {
    const p = svc.createProject({ name: 'Saved' });
    svc.saveProject();
    svc.currentProject = null;
    const loaded = svc.loadProjectFromStorage(p.id);
    expect(loaded.name).toBe('Saved');
  });

  test('loadProjectFromStorage throws for an unknown id', () => {
    expect(() => svc.loadProjectFromStorage('nope')).toThrow(/Project not found/);
  });
});

describe('trim / volume / pan', () => {
  test('volume and pan are range-checked', () => {
    svc.createProject();
    expect(svc.setVolume(1.5)).toBe(1.5);
    expect(() => svc.setVolume(3)).toThrow(/Volume must be/);
    expect(svc.setPan(-0.5)).toBe(-0.5);
    expect(() => svc.setPan(-2)).toThrow(/Pan must be/);
  });

  test('trim bounds are enforced against the project duration', () => {
    svc.createProject();
    svc.currentProject.duration = 10;
    svc.currentProject.trimEnd = 10;
    expect(svc.setTrimStart(2)).toBe(2);
    expect(() => svc.setTrimStart(-1)).toThrow(/trim/i);
  });
});

describe('effects', () => {
  test('addEffect applies catalog defaults and rejects unknown ids', () => {
    svc.createProject();
    const effect = svc.addEffect('reverb', { wet: 0.9 });
    expect(effect.type).toBe('reverb');
    expect(effect.enabled).toBe(true);
    expect(effect.params.wet).toBe(0.9);
    expect(effect.params.roomSize).toBe(AUDIO_EDITOR_CONFIG.EFFECTS.REVERB.params.roomSize.default);
    expect(() => svc.addEffect('nonsense')).toThrow(/Unknown effect/);
  });

  test('updateEffect only writes known params', () => {
    svc.createProject();
    const effect = svc.addEffect('echo');
    svc.updateEffect(effect.id, { delay: 1.25, bogus: 9 });
    expect(effect.params.delay).toBe(1.25);
    expect(effect.params.bogus).toBeUndefined();
  });

  test('toggleEffect flips enabled and removeEffect drops it', () => {
    svc.createProject();
    const effect = svc.addEffect('eq');
    expect(svc.toggleEffect(effect.id)).toBe(false);
    expect(svc.removeEffect(effect.id)).toBe(true);
    expect(svc.currentProject.effects).toHaveLength(0);
    expect(() => svc.removeEffect(effect.id)).toThrow(/Effect not found/);
  });
});

describe('markers', () => {
  test('markers are inserted and kept time-ordered', () => {
    svc.createProject();
    svc.currentProject.duration = 60;
    svc.addMarker(30, 'B');
    svc.addMarker(10, 'A');
    expect(svc.currentProject.markers.map((m) => m.label)).toEqual(['A', 'B']);
  });

  test('a marker outside the duration is rejected', () => {
    svc.createProject();
    svc.currentProject.duration = 5;
    expect(() => svc.addMarker(99)).toThrow(/Invalid marker time/);
  });
});

describe('undo / redo', () => {
  test('undo restores the previous volume and redo reapplies it', () => {
    svc.createProject();
    svc.setVolume(0.5);
    svc.setVolume(1.8);
    expect(svc.currentProject.volume).toBe(1.8);
    svc.undo();
    expect(svc.currentProject.volume).toBe(0.5);
    svc.redo();
    expect(svc.currentProject.volume).toBe(1.8);
  });

  test('undo returns null when there is nothing to undo', () => {
    svc.createProject();
    expect(svc.undo()).toBeNull();
  });

  test('the undo stack is capped', () => {
    svc.createProject();
    for (let i = 0; i < AUDIO_EDITOR_CONFIG.UNDO.MAX_STACK_SIZE + 20; i++) svc.setVolume(1 + (i % 2) * 0.5);
    expect(svc.currentProject.undoStack.length).toBeLessThanOrEqual(AUDIO_EDITOR_CONFIG.UNDO.MAX_STACK_SIZE);
  });
});

describe('waveform and stats', () => {
  test('generateWaveform refuses without decoded audio', () => {
    svc.createProject();
    expect(() => svc.generateWaveform()).toThrow(/No audio loaded/);
  });

  test('getStats reports the real project state', () => {
    svc.createProject({ name: 'Stats' });
    const stats = svc.getStats();
    expect(stats.hasProject).toBe(true);
    expect(stats.hasAudio).toBe(false);
  });

  test('formatTime renders mm:ss.cc', () => {
    expect(svc.formatTime(65.42)).toBe('01:05.42');
  });
});
