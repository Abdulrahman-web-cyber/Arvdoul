import { useTheme } from "@context/ThemeContext";
import TopAppBar from "@components/Shared/TopAppBar";
import BottomNav from "@components/Shared/BottomNav";
import { cn } from "../lib/utils";

export default function MainLayout({ children }) {
  const { theme } = useTheme();

  return (
    <div
      className={cn(
        "flex flex-col w-full min-h-screen",
        "bg-white text-black dark:bg-gray-900 dark:text-white",
        "transition-colors duration-300 ease-in-out",
        theme === "dark" && "dark",
      )}
      data-theme={theme}
    >
      <TopAppBar />

      <main className="flex-1 w-full overflow-x-hidden overflow-y-auto pt-20 pb-24">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
