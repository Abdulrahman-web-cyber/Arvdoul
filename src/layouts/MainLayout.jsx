// src/layouts/MainLayout.jsx – ARVDOUL PERFECT LAYOUT (FULL MAX WIDTH & IMMERSIVE VIDEO SUPPORT)

import { useLocation } from "react-router-dom";
import { useTheme } from "@context/ThemeContext";
import TopAppBar from "@components/Shared/TopAppBar";
import BottomNav from "@components/Shared/BottomNav";
import useScreenView from "../hooks/useScreenView.js";
import { cn } from "../lib/utils";

export default function MainLayout({ children }) {
  const { theme } = useTheme();
  const location = useLocation();
  const isDark = theme === "dark";

  // Screen-view analytics + RUM route timing for every routed screen
  useScreenView();

  const isImmersiveVideo = location.pathname.startsWith("/videos") || location.pathname.startsWith("/reels");
  const isIndividualChat = location.pathname.startsWith("/messages/") && location.pathname !== "/messages/new";
  const isStudioOrCall = location.pathname.startsWith("/call") || location.pathname.startsWith("/video-editor") || location.pathname.startsWith("/audio-editor") || location.pathname.startsWith("/thumbnail-designer") || location.pathname.startsWith("/live/");
  
  const hideTopAppBar = isImmersiveVideo || isIndividualChat || isStudioOrCall;
  const hideBottomNav = isIndividualChat || isStudioOrCall;
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
      ) : isIndividualChat || isStudioOrCall ? (
        <main className="flex-1 w-full h-full min-h-0 relative overflow-hidden flex flex-col">
          {children}
        </main>
      ) : isFullHeightFeed ? (
        <main className="flex-1 w-full min-h-0 relative overflow-hidden flex flex-col pb-20">
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
