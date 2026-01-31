import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import AppBootstrap from "./app/AppBootstrap.jsx";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element (#root) not found");

createRoot(root).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <AppBootstrap />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);