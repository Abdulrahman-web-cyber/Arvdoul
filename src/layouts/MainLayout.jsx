// src/layouts/MainLayout.jsx
import { useTheme } from "@context/ThemeContext";
import TopAppBar from "@components/Shared/TopAppBar";
import BottomNav from "@components/Shared/BottomNav";
import { cn } from "../lib/utils";

export default function MainLayout({ children }) {
  const { theme } = useTheme();

  return (
    <div  
      className={cn(  
        "flex flex-col min-h-screen w-full mx-auto bg-white text-black dark:bg-gray-900 dark:text-white transition-colors duration-300 ease-in-out",  
        "max-w-screen-sm md:max-w-4xl",  
        theme === "dark" && "dark",  
      )}  
      data-theme={theme}  
    >  
      <TopAppBar />  
      <main className="flex-1 w-full overflow-y-auto overflow-x-hidden pt-20 pb-24 md:pb-28">
        <div className="px-4 py-4 max-w-4xl mx-auto">
          {children}
        </div>
      </main>  
      <BottomNav />  
    </div>  
  );  
}