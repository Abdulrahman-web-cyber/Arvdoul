import React from "react";

const NotificationsScreen = () => {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-center max-w-md">
        <h1 className="text-xl font-semibold">Notifications</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          All your alerts, messages, and updates will appear here.
        </p>

        <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">No new notifications</p>
        </div>
      </div>
    </div>
  );
};

export default NotificationsScreen;
