// src/screens/AudioEditor/audioPresets.js
//
// Canonical EQ preset table for the Audio Studio. These are real parametric
// settings (frequency / gain / Q) applied to the mixing graph — not cosmetic

export const EQ_BAND_COLORS = ['#8B1EF3', '#00C4FF', '#10B981', '#F59E0B', '#EF4444'];

export const EQ_RANGES = {
  minFreq: 20,
  maxFreq: 20000,
  minGain: -15,
  maxGain: 15,
};

// [type, frequency Hz, gain dB, Q]
const PRESET_TABLE = {
  Flat: [
    ['HPF', 20, 0, 0.707],
    ['Bell', 250, 0, 1.0],
    ['Bell', 1000, 0, 1.0],
    ['Bell', 4000, 0, 1.0],
    ['LPF', 20000, 0, 0.707],
  ],
  'Vocal Clarity': [
    ['HPF', 80, 0, 0.707],
    ['Bell', 250, -2.1, 1.2],
    ['Bell', 3000, 3.4, 1.0],
    ['Bell', 6000, -1.6, 1.4],
    ['LPF', 16000, 0, 0.707],
  ],
  'Podcast Voice': [
    ['HPF', 100, 0, 0.707],
    ['Bell', 200, -3.0, 1.4],
    ['Bell', 2500, 2.5, 0.9],
    ['Bell', 8000, -2.0, 1.2],
    ['LPF', 14000, 0, 0.707],
  ],
  'Bass Boost': [
    ['HPF', 30, 0, 0.707],
    ['Bell', 80, 5.5, 1.0],
    ['Bell', 400, -1.5, 1.2],
    ['Bell', 4000, 0, 1.0],
    ['LPF', 18000, 0, 0.707],
  ],
  'Bright Air': [
    ['HPF', 60, 0, 0.707],
    ['Bell', 300, -1.0, 1.0],
    ['Bell', 5000, 2.0, 0.9],
    ['Bell', 12000, 3.5, 0.8],
    ['LPF', 20000, 0, 0.707],
  ],
  'Telephone': [
    ['HPF', 300, 0, 0.707],
    ['Bell', 1000, 2.0, 1.0],
    ['Bell', 2000, 1.5, 1.0],
    ['Bell', 3400, -4.0, 1.2],
    ['LPF', 3400, 0, 0.707],
  ],
};

export const EQ_PRESET_NAMES = Object.freeze(Object.keys(PRESET_TABLE));

/**
 * Returns a fresh, mutable band array for a preset. Unknown names fall back to
 * Flat so a stale saved name can never produce an undefined band list.
 * @param {string} name
 * @returns {Array<{id:number,type:string,freq:number,gain:number,q:number,color:string}>}
 */
export function getPresetBands(name) {
  const rows = PRESET_TABLE[name] || PRESET_TABLE.Flat;
  return rows.map(([type, freq, gain, q], i) => ({
    id: i + 1,
    type,
    freq,
    gain,
    q,
    color: EQ_BAND_COLORS[i],
  }));
}

export const DEFAULT_EQ_PRESET = 'Flat';
