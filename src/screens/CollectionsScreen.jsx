import React from "react";

const CollectionsScreen = () => {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-center max-w-md">
        <h1 className="text-xl font-semibold">Collections</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          View and manage your collections, albums, and saved content here.
        </p>

        <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Collections functionality will be added soon.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CollectionsScreen;
