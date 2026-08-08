// src/layouts/MainLayout.jsx – ARVDOUL PERFECT LAYOUT (FULL MAX WIDTH & IMMERSIVE VIDEO SUPPORT)

import { useLocation } from "react-router-dom";
import { useTheme } from "@context/ThemeContext";
import TopAppBar from "@components/Shared/TopAppBar";
import BottomNav from "@components/Shared/BottomNav";
import { OfflineIndicator } from "@components/ui/OfflineIndicator";
import { cn } from "../lib/utils";

export default function MainLayout({ children }) {
  const { theme } = useTheme();
  const location = useLocation();
  const isDark = theme === "dark";

  const isImmersiveVideo = location.pathname.startsWith("/videos") || location.pathname.startsWith("/reels");
  const isFullHeightFeed = isImmersiveVideo || location.pathname === "/home" || location.pathname === "/" || location.pathname.startsWith("/messages") || location.pathname.startsWith("/chat");

  return (
    <div
      className={cn(
        "flex flex-col h-screen w-screen overflow-hidden",
        isDark
          ? "bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]"
          : "bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]"
      )}
    >
      {/* Offline sync indicator */}
      <OfflineIndicator />

      {/* Top App Bar (Hidden on immersive full-screen video feeds) */}
      {!isImmersiveVideo && <TopAppBar />}

      {/* Main Content */}
      {isFullHeightFeed ? (
        <main className="flex-1 w-full min-h-0 relative overflow-hidden flex flex-col pb-16">
          {children}
        </main>
      ) : (
        <main className="flex-1 overflow-y-auto overscroll-contain pt-4 pb-20 w-full">
          <div className="w-full px-2 sm:px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      )}

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
