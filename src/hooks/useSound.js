// src/hooks/useSound.js
/**
 * Professional Sound Hook
 * Battery optimized sound system
 */

const useSound = () => {
  const playSound = (type, volume = 0.3) => {
    // Don't play sounds if user prefers reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    // Create audio context if needed
    if (!window.soundContext) {
      window.soundContext = {
        cache: {},
        activeSounds: new Set()
      };
    }

    const soundMap = {
      ui_click: "/sounds/click.mp3",
      ui_toggle: "/sounds/toggle.mp3",
      ui_search: "/sounds/search.mp3",
      ui_menu: "/sounds/menu.mp3",
      nav_click: "/sounds/nav-click.mp3",
      ui_notification: "/sounds/notification.mp3",
      ui_logout: "/sounds/logout.mp3",
      ui_create: "/sounds/create.mp3"
    };

    const soundUrl = soundMap[type];
    if (!soundUrl) {
      console.warn(`Sound type "${type}" not found`);
      return;
    }

    try {
      const audio = new Audio(soundUrl);
      audio.volume = volume;
      audio.preload = "auto";
      
      // Play sound
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.debug("Audio play prevented:", error);
        });
      }
      
      // Clean up after playing
      audio.onended = () => {
        audio.remove();
      };
    } catch (error) {
      console.warn(`Failed to play sound "${type}":`, error);
    }
  };

  return { playSound };
};

export { useSound };
