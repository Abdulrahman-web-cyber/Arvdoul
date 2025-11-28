import { useState, useEffect } from "react";

/**
 * Custom hook to detect media query matches.
 * @param {string} query - CSS media query string (e.g., '(max-width: 768px)')
 * @returns {boolean} - True if media query matches, else false
 */
export const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handleChange = () => setMatches(mediaQuery.matches);

    handleChange(); // Set initial match
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
};
