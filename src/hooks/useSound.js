// src/hooks/useSound.js
//
// Tactile UI feedback synthesized cleanly via Web Audio API (no broken 1-byte MP3
// fetches, no autoplay asset errors). Respects settings.notifications.soundFx.

let soundFxEnabled = true;
let audioCtx = null;

export function setSoundFxEnabled(enabled) {
  soundFxEnabled = enabled !== false;
}

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (audioCtx && audioCtx.state !== 'closed') return audioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try {
    audioCtx = new Ctx();
    return audioCtx;
  } catch {
    return null;
  }
}

export const useSound = () => {
  const playSound = (type) => {
    try {
      if (!soundFxEnabled) return;
      if (type !== 'nav_click' && type !== 'panel_open' && type !== 'ui_click') return;

      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      const baseFreq = type === 'panel_open' ? 540 : 680;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.025);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.045, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.036);
    } catch {
      // Safe no-op if audio context blocked
    }
  };

  return { playSound };
};
