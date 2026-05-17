const clickSound = "/sounds/click.mp3"; // Make sure this exists

export const useSound = () => {
  const playSound = (type) => {
    if (type === "nav_click") {
      const audio = new Audio(clickSound);
      audio.volume = 0.3;
      audio.play();
    }
  };

  return { playSound };
};
