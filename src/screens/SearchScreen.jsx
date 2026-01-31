import React from "react";

const SearchScreen = () => {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-center max-w-md">
        <h1 className="text-xl font-semibold">Search</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Search for users, posts, hashtags, or content here.
        </p>

        <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Search functionality will be implemented soon.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SearchScreen;
