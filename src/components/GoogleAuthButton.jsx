import React from "react";
import { FcGoogle } from "react-icons/fc";

export default function GoogleAuthButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-3 py-3 px-4
                 rounded-xl border border-gray-300 dark:border-gray-700
                 bg-white dark:bg-gray-900
                 text-gray-800 dark:text-gray-200
                 hover:bg-gray-50 dark:hover:bg-gray-800
                 transition font-medium"
    >
      <FcGoogle className="text-xl" />
      Continue with Google
    </button>
  );
}
