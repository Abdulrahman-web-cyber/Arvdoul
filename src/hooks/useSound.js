const clickSound = "/sounds/click.mp3";

export const useSound = () => {
  const playSound = (type) => {
    try {
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
