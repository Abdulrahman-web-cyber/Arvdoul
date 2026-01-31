import React from "react";

const ProfileScreen = () => {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-center max-w-md">
        <h1 className="text-xl font-semibold">Profile</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Your personal profile, posts, and activity will appear here.
        </p>

        <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Profile data and settings will be implemented soon.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProfileScreen;
