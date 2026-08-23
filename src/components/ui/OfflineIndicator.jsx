import { useEffect, useState } from "react";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    const handleOffline = () => {
      setIsOnline(false);
      setShowBackOnline(false);
    };

    const handleOnline = () => {
      setIsOnline(true);
      setShowBackOnline(true);

      const timeout = window.setTimeout(() => {
        setShowBackOnline(false);
      }, 3000);

      return () => window.clearTimeout(timeout);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (isOnline && !showBackOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "fixed inset-x-0 top-0 z-[9999]",
        "flex justify-center px-3 pt-[env(safe-area-inset-top)]",
        "pointer-events-none",
      ].join(" ")}
    >
      <div
        className={[
          "pointer-events-auto mt-2",
          "flex items-center gap-2",
          "rounded-full border border-white/10",
          "bg-[#03071B]/95 backdrop-blur-xl",
          "px-4 py-2",
          "text-sm font-medium text-white",
          "shadow-lg shadow-black/30",
          "transition-all duration-300",
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className={[
            "h-2 w-2 rounded-full",
            isOnline ? "bg-green-400" : "bg-red-400",
          ].join(" ")}
        />

        <span>
          {isOnline
            ? "Back online"
            : "You're offline. Changes will sync when you're back online."}
        </span>
      </div>
    </div>
  );
}
