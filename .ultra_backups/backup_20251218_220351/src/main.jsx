import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

 Core Providers
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";  even if auth not ready

 Global styles
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("[ARVDOUL BOOT ERROR] Root element not found");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);