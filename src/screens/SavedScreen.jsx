import React from "react";

const SavedScreen = () => {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-center max-w-md">
        <h1 className="text-xl font-semibold">Saved</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Your saved posts, videos, and collections will appear here.
        </p>

        <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Saved content functionality will be implemented soon.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SavedScreen;
