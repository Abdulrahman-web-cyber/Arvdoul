import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/tailwind.css";

// Context Providers
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { UserProvider } from "./context/UserContext";
import { AppStoreProvider } from "./context/AppStoreContext";
import { PostsProvider } from "./context/PostsContext";
import { CommentsProvider } from "./context/CommentsContext";
import { MessagingProvider } from "./context/MessagingContext";

// Root render
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <UserProvider>
          <AppStoreProvider>
            <PostsProvider>
              <CommentsProvider>
                <MessagingProvider>
                  <BrowserRouter>
                    <App />
                  </BrowserRouter>
                </MessagingProvider>
              </CommentsProvider>
            </PostsProvider>
          </AppStoreProvider>
        </UserProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);