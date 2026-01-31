import { Outlet } from "react-router-dom";
import { useTheme } from "@context/ThemeContext";
import TopAppBar from "@components/Shared/TopAppBar";
import BottomNav from "@components/Shared/BottomNav";
import { cn } from "../lib/utils";

export default function MainLayout() {
  const { theme } = useTheme();

  return (
    <div
      className={cn(
        "flex flex-col min-h-screen w-full mx-auto bg-white text-black dark:bg-zinc-900 dark:text-white transition-colors duration-300 ease-in-out",
        "max-w-screen-sm md:max-w-4xl",
        theme === "dark" && "dark",
      )}
      data-theme={theme}
    >
      <TopAppBar />
      <main className="flex-grow px-4 pt-14 pb-16 md:pb-8 max-w-4xl mx-auto">
        {/* pt-14 = TopAppBar height, pb-16 = BottomNav height */}
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
