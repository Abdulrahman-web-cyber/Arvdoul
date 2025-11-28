// src/context/ThemeContext.jsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

// ThemeContext with toggle + system detection
const ThemeContext = createContext({
  theme: "light",
  systemTheme: "light",
  toggleTheme: () => {},
});

/**
 * ThemeProvider to manage light/dark/system themes
 */
export const ThemeProvider = ({ children }) => {
  const getInitialTheme = () => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem("theme") || "system";
  };

  const [theme, setTheme] = useState(getInitialTheme);
  const [systemTheme, setSystemTheme] = useState("light");

  // Detect system dark mode
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => setSystemTheme(e.matches ? "dark" : "light");

    handleChange(mq); // Set initial
    mq.addEventListener("change", handleChange);

    return () => mq.removeEventListener("change", handleChange);
  }, []);

  // Apply theme to document root
  useEffect(() => {
    const root = document.documentElement;
    const appliedTheme = theme === "system" ? systemTheme : theme;
    if (appliedTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme, systemTheme]);

  // Toggle logic: light → dark → system → light
  const toggleTheme = useCallback(() => {
    setTheme((prev) =>
      prev === "light" ? "dark" : prev === "dark" ? "system" : "light",
    );
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, systemTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook to access theme context
 */
export const useTheme = () => useContext(ThemeContext);

export { ThemeContext };
