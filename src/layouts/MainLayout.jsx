// src/layouts/MainLayout.jsx

import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "@context/ThemeContext";
import TopAppBar from "@components/Shared/TopAppBar";
import BottomNav from "@components/Shared/BottomNav";
import DesktopNavRail from "@components/Shared/DesktopNavRail";
import useScreenView from "../hooks/useScreenView.js";
import { LayoutChromeProvider } from "../context/LayoutChromeContext.jsx";
import { cn } from "../lib/utils";
import { brandCanvasBackground } from "../design-system/tokens.js";

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
  const isMessagesRoute = location.pathname === "/messages" || location.pathname.startsWith("/messages/");
  const isMessagesSubroute = location.pathname.startsWith("/messages/");
  const isIndividualChat = isMessagesSubroute && location.pathname !== "/messages/new";
  const isDedicatedStudioOrCall = (
    location.pathname.startsWith("/call") ||
    location.pathname.startsWith("/video-editor") ||
    location.pathname.startsWith("/audio-editor") ||
    location.pathname.startsWith("/thumbnail-designer") ||
    location.pathname.startsWith("/live") ||
    location.pathname.startsWith("/camera")
  );
  const isAdminRoute = location.pathname.startsWith("/admin");

  const isCreatePost = location.pathname.startsWith("/create-post");
  const isCreateStory = location.pathname.startsWith("/create-story");

  // TopAppBar stays active across all messaging screens and coordinates via
  // LayoutChromeProvider so chat & inbox never render duplicate headers.
  const hideTopAppBar = isImmersiveVideo || isDedicatedStudioOrCall || isCreateStory;
  const hideTopAppBarOnDesktop = isAdminRoute || location.pathname === "/home" || location.pathname === "/";
  const hideBottomNav = isMessagesSubroute || isDedicatedStudioOrCall || isCreateStory;
  const showDesktopRail = !isDedicatedStudioOrCall && !isCreateStory;
  const isFullHeightFeed = isImmersiveVideo || location.pathname === "/home" || location.pathname === "/" || isMessagesRoute;
  const hasTopAppBar = !hideTopAppBar;

  return (
    <LayoutChromeProvider hasTopAppBar={hasTopAppBar}>
      <div
        className={cn(
          // The viewport-width utility overflows by the scrollbar width on
          // desktop and caused a horizontal scrollbar; `w-full` fills the shell.
          // `h-[100dvh]` tracks the *dynamic* viewport so the fixed bottom nav and
          // the shell bottom stay reachable while a mobile URL bar is showing
          // (a plain `h-screen`/100vh measures the tall viewport and clips them).
          "flex flex-col h-[100dvh] w-full overflow-hidden"
        )}
        // Canvas comes from the design-system helper (base colour + brand glow),
        // replacing the raw-hex gradients that bypassed the tokens.
        style={{ background: brandCanvasBackground(isDark) }}
      >
        {/* Keyboard bypass for the fixed chrome (WCAG 2.4.1). Visually hidden
            until focused, then pinned to the top-left above everything. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[300] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-arvdoul-purple focus:shadow-lg dark:focus:bg-[#0b1020] dark:focus:text-white"
        >
          Skip to content
        </a>

        <div className="flex flex-1 min-h-0 w-full overflow-hidden">
          {showDesktopRail && <DesktopNavRail />}

          <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
            {/* Top App Bar (Hidden on immersive full-screen video feeds and studio/call views;
                desktop /home and /admin* rely on DesktopNavRail / AdminNavHeader) */}
            {!hideTopAppBar && (
              hideTopAppBarOnDesktop ? (
                <div className="lg:hidden shrink-0">
                  <TopAppBar />
                </div>
              ) : (
                <TopAppBar />
              )
            )}

            {/* Main Content */}
            {isImmersiveVideo ? (
              <main id="main-content" tabIndex={-1} className="flex-1 w-full h-full min-h-0 relative overflow-hidden flex flex-col">
                {children}
              </main>
            ) : isIndividualChat || isDedicatedStudioOrCall || isCreateStory ? (
              <main id="main-content" tabIndex={-1} className="flex-1 w-full h-full min-h-0 relative overflow-hidden flex flex-col">
                {children}
              </main>
            ) : isCreatePost ? (
              <main id="main-content" tabIndex={-1} className="flex-1 w-full min-h-0 relative overflow-y-auto pb-20 lg:pb-8">
                {children}
              </main>
            ) : isFullHeightFeed ? (
              <main id="main-content" tabIndex={-1} className="flex-1 w-full min-h-0 relative overflow-hidden flex flex-col">
                {children}
              </main>
            ) : (
              <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto overscroll-contain pt-4 pb-24 lg:pb-8 w-full">
                <div className="w-full px-2 sm:px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
                  {children}
                </div>
              </main>
            )}
          </div>
        </div>

        {/* Bottom Navigation (mobile/tablet only — desktop uses DesktopNavRail) */}
        {!hideBottomNav && (
          <div className="lg:hidden shrink-0">
            <BottomNav />
          </div>
        )}
      </div>
    </LayoutChromeProvider>
  );
}
