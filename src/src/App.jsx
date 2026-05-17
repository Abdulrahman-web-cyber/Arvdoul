// src/App.jsx - UPDATED
import React from "react";
import AppRoutes from "./routes/AppRoutes.jsx";
import { useTheme } from "./context/ThemeContext.jsx";

export default function App() {
  const { theme } = useTheme();

  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <AppRoutes />
    </div>
  );
}