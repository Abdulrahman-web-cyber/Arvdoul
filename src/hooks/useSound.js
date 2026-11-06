const clickSound = "/sounds/click.mp3";

// Module-level cache of the signed-in user's `notifications.soundFx` setting.
// `useSound` is called from many leaf components that cannot each afford a
// settings read, so the value is set once by the settings hook and read here.
let soundFxEnabled = true;

export function setSoundFxEnabled(enabled) {
  soundFxEnabled = enabled !== false;
}

export const useSound = () => {
  const playSound = (type) => {
    try {
      // The `settings.notifications.soundFx` toggle was inert: this hook played
      // regardless. Honour it.
      if (!soundFxEnabled) return;
      if (type === "nav_click" || type === "panel_open") {
        const audio = new Audio(clickSound);
        audio.volume = 0.25;
        audio.play().catch(() => {});
      }
    } catch {
      // Audio playback safely ignored if disabled or not allowed
    }
  };

  return { playSound };
};
