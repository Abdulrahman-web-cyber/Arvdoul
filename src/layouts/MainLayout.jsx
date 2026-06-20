// src/layouts/MainLayout.jsx – ARVDOUL PERFECT LAYOUT (FULL MAX WIDTH)

import { useTheme } from "@context/ThemeContext";
import TopAppBar from "@components/Shared/TopAppBar";
import BottomNav from "@components/Shared/BottomNav";
import { cn } from "../lib/utils";

export default function MainLayout({ children }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      className={cn(
        "flex flex-col h-screen w-screen overflow-hidden",
        isDark
          ? "bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]"
          : "bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]"
      )}
    >
      {/* Top App Bar */}
      <TopAppBar />

      {/* Main Content (FULL WIDTH, NO CONSTRAINT) */}
      <main className="flex-1 overflow-y-auto overscroll-contain pt-4 pb-20 w-full">
        <div className="w-full px-2 sm:px-4 md:px-6 lg:px-8">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}