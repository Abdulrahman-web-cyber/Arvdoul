// src/layouts/MainLayout.jsx

import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "@context/ThemeContext";
import TopAppBar from "@components/Shared/TopAppBar";
import BottomNav from "@components/Shared/BottomNav";
import useScreenView from "../hooks/useScreenView.js";
import { cn } from "../lib/utils";

/** Accept only same-origin, in-app paths from an event payload. */
function safeInternalPath(url) {
  if (typeof url !== "string" || !url) return null;
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin !== window.location.origin) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export default function MainLayout({ children }) {
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const isDark = theme === "dark";

  // Screen-view analytics + RUM route timing for every routed screen
  useScreenView();

  // Deep links from a foreground notification click. notificationsService
  // dispatches `arvdoul:navigate` with the target URL; without this listener
  // the click focused the tab but never moved — the notification was a dead
  // link.
  useEffect(() => {
    const handleNavigate = (event) => {
      const path = safeInternalPath(event?.detail?.url);
      if (path) navigate(path);
    };
    window.addEventListener("arvdoul:navigate", handleNavigate);
    return () => window.removeEventListener("arvdoul:navigate", handleNavigate);
  }, [navigate]);

  const isImmersiveVideo = location.pathname.startsWith("/videos") || location.pathname.startsWith("/reels");
  const isIndividualChat = location.pathname.startsWith("/messages/") && location.pathname !== "/messages/new";
  const isDedicatedStudioOrCall = (
    location.pathname.startsWith("/call") ||
    location.pathname.startsWith("/video-editor") ||
    location.pathname.startsWith("/audio-editor") ||
    location.pathname.startsWith("/thumbnail-designer") ||
    location.pathname.startsWith("/image-editor") ||
    location.pathname.startsWith("/image-studio") ||
    location.pathname.startsWith("/live") ||
    location.pathname.startsWith("/camera")
  );
  
  const isCreatePost = location.pathname.startsWith("/create-post");
  const isCreateStory = location.pathname.startsWith("/create-story");

  // create-post displays the top app bar and bottom nav; stories, immersive video and studios hide them
  const hideTopAppBar = isImmersiveVideo || isIndividualChat || isDedicatedStudioOrCall || isCreateStory;
  const hideBottomNav = isIndividualChat || isDedicatedStudioOrCall || isCreateStory;
  const isFullHeightFeed = isImmersiveVideo || location.pathname === "/home" || location.pathname === "/" || location.pathname === "/messages";

  return (
    <div
      className={cn(
        "flex flex-col h-screen w-screen overflow-hidden",
        isDark
          ? "bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]"
          : "bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]"
      )}
    >
      {/* Top App Bar (Hidden on immersive full-screen video feeds and individual chat) */}
      {!hideTopAppBar && <TopAppBar />}

      {/* Main Content */}
      {isImmersiveVideo ? (
        <main className="flex-1 w-full h-full min-h-0 relative overflow-hidden flex flex-col">
          {children}
        </main>
      ) : isIndividualChat || isDedicatedStudioOrCall || isCreateStory ? (
        <main className="flex-1 w-full h-full min-h-0 relative overflow-hidden flex flex-col">
          {children}
        </main>
      ) : isCreatePost ? (
        <main className="flex-1 w-full min-h-0 relative overflow-y-auto pb-20">
          {children}
        </main>
      ) : isFullHeightFeed ? (
        <main className="flex-1 w-full min-h-0 relative overflow-hidden flex flex-col">
          {children}
        </main>
      ) : (
        <main className="flex-1 overflow-y-auto overscroll-contain pt-4 pb-24 w-full">
          <div className="w-full px-2 sm:px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      )}

      {/* Bottom Navigation */}
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
